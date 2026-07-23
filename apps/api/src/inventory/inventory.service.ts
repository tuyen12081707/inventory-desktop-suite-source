import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DashboardSummary, DocumentType, StockDocumentSummary } from '@inventory/contracts';
import { Prisma, type StockDocument } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { getStockLevel } from './domain/stock-level';
import { movementDeltas } from './domain/stock-policy';

interface DocumentCreateInput {
  type: DocumentType;
  warehouseId: string;
  destinationWarehouseId?: string;
  reference?: string;
  note?: string;
  idempotencyKey: string;
  lines: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
}

export interface StockRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  averageCost: number;
  value: number;
  reorderPoint: number;
  productStockTotal: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(companyId: string): Promise<DashboardSummary> {
    const [products, balances, draftDocuments, recentDocuments] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { companyId, active: true },
        select: { id: true, reorderPoint: true },
      }),
      this.prisma.stockBalance.findMany({
        where: { warehouse: { companyId }, product: { active: true } },
        include: { product: true },
      }),
      this.prisma.stockDocument.count({ where: { companyId, status: 'DRAFT' } }),
      this.prisma.stockDocument.findMany({
        where: { companyId },
        include: { warehouse: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const totalsByProduct = new Map(products.map((product) => [product.id, 0]));
    const reorderPoints = new Map(
      products.map((product) => [product.id, Number(product.reorderPoint)]),
    );
    let totalQuantity = 0;
    let inventoryValue = 0;
    for (const balance of balances) {
      const quantity = Number(balance.quantity);
      totalQuantity += quantity;
      inventoryValue += quantity * Number(balance.averageCost);
      totalsByProduct.set(
        balance.productId,
        (totalsByProduct.get(balance.productId) ?? 0) + quantity,
      );
    }
    let lowStockProducts = 0;
    for (const [productId, quantity] of totalsByProduct) {
      if (getStockLevel(quantity, reorderPoints.get(productId) ?? 0) !== 'IN_STOCK') {
        lowStockProducts += 1;
      }
    }

    return {
      totalProducts: products.length,
      totalQuantity,
      lowStockProducts,
      inventoryValue,
      draftDocuments,
      recentDocuments: recentDocuments.map((document) => ({
        id: document.id,
        number: document.number,
        type: document.type,
        status: document.status,
        warehouseName: document.warehouse.name,
        createdAt: document.createdAt.toISOString(),
      })),
    };
  }

  async stock(companyId: string, warehouseId?: string): Promise<StockRow[]> {
    const [balances, totals] = await this.prisma.$transaction([
      this.prisma.stockBalance.findMany({
        where: {
          warehouse: { companyId },
          product: { active: true },
          ...(warehouseId ? { warehouseId } : {}),
        },
        include: { warehouse: true, product: true },
        orderBy: [{ warehouse: { name: 'asc' } }, { product: { name: 'asc' } }],
      }),
      this.prisma.stockBalance.groupBy({
        by: ['productId'],
        where: { warehouse: { companyId }, product: { active: true } },
        orderBy: { productId: 'asc' },
        _sum: { quantity: true },
      }),
    ]);
    const productTotals = new Map(
      totals.map((total) => [total.productId, Number(total._sum?.quantity ?? 0)]),
    );
    return balances.map((balance) => {
      const quantity = Number(balance.quantity);
      const averageCost = Number(balance.averageCost);
      return {
        warehouseId: balance.warehouseId,
        warehouseCode: balance.warehouse.code,
        warehouseName: balance.warehouse.name,
        productId: balance.productId,
        sku: balance.product.sku,
        productName: balance.product.name,
        unit: balance.product.unit,
        quantity,
        averageCost,
        value: quantity * averageCost,
        reorderPoint: Number(balance.product.reorderPoint),
        productStockTotal: productTotals.get(balance.productId) ?? quantity,
      };
    });
  }

  async listDocuments(companyId: string): Promise<StockDocumentSummary[]> {
    const documents = await this.prisma.stockDocument.findMany({
      where: { companyId },
      include: {
        warehouse: true,
        destinationWarehouse: true,
        createdBy: true,
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return documents.map((document) => this.toDocumentSummary(document));
  }

  async createDocument(
    companyId: string,
    actorId: string,
    input: DocumentCreateInput,
  ): Promise<StockDocumentSummary> {
    const duplicateProductIds = input.lines
      .map((line) => line.productId)
      .filter((productId, index, all) => all.indexOf(productId) !== index);
    if (duplicateProductIds.length) {
      throw new BadRequestException('Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu');
    }

    const [warehouses, productCount] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where: {
          companyId,
          id: {
            in: [input.warehouseId, input.destinationWarehouseId].filter((id): id is string =>
              Boolean(id),
            ),
          },
          active: true,
        },
      }),
      this.prisma.product.count({
        where: {
          companyId,
          active: true,
          id: { in: input.lines.map((line) => line.productId) },
        },
      }),
    ]);
    const expectedWarehouses = input.destinationWarehouseId ? 2 : 1;
    if (warehouses.length !== expectedWarehouses) {
      throw new BadRequestException('Kho nguồn hoặc kho đích không hợp lệ');
    }
    if (productCount !== input.lines.length) {
      throw new BadRequestException('Phiếu có sản phẩm không hợp lệ');
    }

    try {
      const document = await this.prisma.stockDocument.create({
        data: {
          companyId,
          number: this.generateDocumentNumber(input.type),
          type: input.type,
          warehouseId: input.warehouseId,
          destinationWarehouseId: input.destinationWarehouseId,
          reference: input.reference,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
          createdById: actorId,
          lines: {
            create: input.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitCost: line.unitCost,
            })),
          },
        },
        include: this.documentSummaryInclude,
      });
      await this.prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          entityType: 'StockDocument',
          entityId: document.id,
          action: 'CREATE',
          after: {
            number: document.number,
            type: document.type,
            lineCount: document._count.lines,
          },
        },
      });
      return this.toDocumentSummary(document);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existing = await this.prisma.stockDocument.findFirst({
          where: { companyId, idempotencyKey: input.idempotencyKey },
          include: this.documentSummaryInclude,
        });
        if (existing) return this.toDocumentSummary(existing);
      }
      throw error;
    }
  }

  async approve(companyId: string, actorId: string, documentId: string): Promise<void> {
    const approved = await this.prisma.stockDocument.updateMany({
      where: { id: documentId, companyId, status: 'DRAFT' },
      data: {
        status: 'APPROVED',
        approvedById: actorId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (approved.count !== 1) {
      throw new ConflictException('Chỉ phiếu nháp mới có thể được duyệt');
    }
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        entityType: 'StockDocument',
        entityId: documentId,
        action: 'APPROVE',
      },
    });
  }

  async post(companyId: string, actorId: string, documentId: string): Promise<void> {
    await this.runSerializable(async (tx) => {
      const document = await tx.stockDocument.findFirst({
        where: { id: documentId, companyId },
        include: { lines: true },
      });
      if (!document) throw new NotFoundException('Không tìm thấy phiếu kho');
      if (document.status === 'POSTED') return;
      if (document.status !== 'APPROVED') {
        throw new ConflictException('Phiếu phải được duyệt trước khi ghi sổ');
      }

      for (const line of document.lines) {
        const movements = movementDeltas(document.type, Number(line.quantity));
        for (const movement of movements) {
          const warehouseId =
            movement.target === 'source' ? document.warehouseId : document.destinationWarehouseId;
          if (!warehouseId) {
            throw new BadRequestException('Phiếu chuyển kho thiếu kho đích');
          }
          const balance = await this.applyDelta(
            tx,
            warehouseId,
            line.productId,
            movement.delta,
            Number(line.unitCost),
          );
          await tx.stockLedger.create({
            data: {
              companyId,
              documentId: document.id,
              documentLineId: line.id,
              warehouseId,
              productId: line.productId,
              quantityDelta: movement.delta,
              unitCost: line.unitCost,
              balanceAfter: balance.quantity,
            },
          });
        }
      }

      const posted = await tx.stockDocument.updateMany({
        where: { id: document.id, status: 'APPROVED' },
        data: { status: 'POSTED', postedAt: new Date(), version: { increment: 1 } },
      });
      if (posted.count !== 1) {
        throw new ConflictException('Trạng thái phiếu đã thay đổi, vui lòng tải lại');
      }
      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          entityType: 'StockDocument',
          entityId: document.id,
          action: 'POST',
          after: { status: 'POSTED' },
        },
      });
    });
  }

  private async applyDelta(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    productId: string,
    delta: number,
    unitCost: number,
  ) {
    const key = { warehouseId_productId: { warehouseId, productId } };
    const current = await tx.stockBalance.findUnique({ where: key });

    if (delta < 0) {
      const changed = await tx.stockBalance.updateMany({
        where: {
          warehouseId,
          productId,
          quantity: { gte: Math.abs(delta) },
        },
        data: {
          quantity: { decrement: Math.abs(delta) },
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Không đủ tồn kho để ghi sổ phiếu');
      }
      return tx.stockBalance.findUniqueOrThrow({ where: key });
    }

    const currentQuantity = Number(current?.quantity ?? 0);
    const currentCost = Number(current?.averageCost ?? 0);
    const nextQuantity = currentQuantity + delta;
    const nextAverageCost =
      unitCost > 0
        ? currentQuantity <= 0
          ? unitCost
          : (currentQuantity * currentCost + delta * unitCost) / nextQuantity
        : currentCost;

    return tx.stockBalance.upsert({
      where: key,
      create: {
        warehouseId,
        productId,
        quantity: delta,
        averageCost: nextAverageCost,
      },
      update: {
        quantity: nextQuantity,
        averageCost: nextAverageCost,
        version: { increment: 1 },
      },
    });
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15_000,
        });
      } catch (error) {
        const retryable =
          typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
        if (!retryable || attempt === 3) throw error;
      }
    }
    throw new Error('Unreachable transaction retry state');
  }

  private generateDocumentNumber(type: DocumentType): string {
    const prefix: Record<DocumentType, string> = {
      RECEIPT: 'PN',
      ISSUE: 'PX',
      TRANSFER: 'CK',
      ADJUSTMENT: 'DC',
    };
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `${prefix[type]}-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private readonly documentSummaryInclude = {
    warehouse: true,
    destinationWarehouse: true,
    createdBy: true,
    _count: { select: { lines: true } },
  } satisfies Prisma.StockDocumentInclude;

  private toDocumentSummary(
    document: StockDocument & {
      warehouse: { name: string };
      destinationWarehouse: { name: string } | null;
      createdBy: { fullName: string };
      _count: { lines: number };
    },
  ): StockDocumentSummary {
    return {
      id: document.id,
      number: document.number,
      type: document.type,
      status: document.status,
      warehouseName: document.warehouse.name,
      destinationWarehouseName: document.destinationWarehouse?.name,
      reference: document.reference ?? undefined,
      createdByName: document.createdBy.fullName,
      lineCount: document._count.lines,
      createdAt: document.createdAt.toISOString(),
      postedAt: document.postedAt?.toISOString(),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
