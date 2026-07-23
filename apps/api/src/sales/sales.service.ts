import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CompanySettings,
  PaymentMethod,
  PosCatalogItem,
  SaleReceipt,
} from '@inventory/contracts';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateSaleTotals } from './domain/sale-policy';

interface CheckoutInput {
  warehouseId: string;
  customerName?: string;
  customerPhone?: string;
  discount: number;
  taxRate: number;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  lines: Array<{
    productId: string;
    quantity: number;
  }>;
}

const saleReceiptInclude = {
  company: true,
  warehouse: true,
  soldBy: true,
  lines: {
    include: { product: true },
    orderBy: { product: { name: 'asc' } },
  },
} satisfies Prisma.SaleInclude;

type SaleWithReceipt = Prisma.SaleGetPayload<{ include: typeof saleReceiptInclude }>;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(companyId: string, warehouseId: string, search: string): Promise<PosCatalogItem[]> {
    await this.ensureWarehouse(companyId, warehouseId);
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        active: true,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { barcodes: { some: { code: { contains: search } } } },
              ],
            }
          : {}),
      },
      include: {
        barcodes: { where: { primary: true }, take: 1 },
        balances: { where: { warehouseId }, take: 1 },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 200,
    });
    return products.map((product) => this.toCatalogItem(product));
  }

  async resolveProduct(
    companyId: string,
    warehouseId: string,
    rawCode: string,
  ): Promise<PosCatalogItem> {
    await this.ensureWarehouse(companyId, warehouseId);
    const code = rawCode.trim();
    if (!code) throw new BadRequestException('Hãy quét barcode hoặc nhập mã sản phẩm');
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
    const product = await this.prisma.product.findFirst({
      where: {
        companyId,
        active: true,
        OR: [
          { sku: { equals: code, mode: 'insensitive' } },
          { barcodes: { some: { code } } },
          ...(isUuid ? [{ id: code }] : []),
        ],
      },
      include: {
        barcodes: { where: { primary: true }, take: 1 },
        balances: { where: { warehouseId }, take: 1 },
      },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với mã "${code}"`);
    }
    return this.toCatalogItem(product);
  }

  async recent(companyId: string, warehouseId?: string): Promise<SaleReceipt[]> {
    const sales = await this.prisma.sale.findMany({
      where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
      include: saleReceiptInclude,
      orderBy: { soldAt: 'desc' },
      take: 50,
    });
    return sales.map((sale) => this.toReceipt(sale));
  }

  async receipt(companyId: string, saleId: string): Promise<SaleReceipt> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: saleReceiptInclude,
    });
    if (!sale) throw new NotFoundException('Không tìm thấy hóa đơn');
    return this.toReceipt(sale);
  }

  async checkout(companyId: string, actorId: string, input: CheckoutInput): Promise<SaleReceipt> {
    const productIds = input.lines.map((line) => line.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Giỏ hàng có sản phẩm bị trùng');
    }

    try {
      return await this.runSerializable(async (tx) => {
        const existing = await tx.sale.findFirst({
          where: { companyId, idempotencyKey: input.idempotencyKey },
          include: saleReceiptInclude,
        });
        if (existing) return this.toReceipt(existing);

        const warehouse = await tx.warehouse.findFirst({
          where: { id: input.warehouseId, companyId, active: true },
        });
        if (!warehouse) throw new BadRequestException('Kho bán hàng không hợp lệ');

        const products = await tx.product.findMany({
          where: { id: { in: productIds }, companyId, active: true },
          include: {
            balances: { where: { warehouseId: input.warehouseId }, take: 1 },
          },
        });
        if (products.length !== productIds.length) {
          throw new BadRequestException('Giỏ hàng có sản phẩm không hợp lệ');
        }

        const productsById = new Map(products.map((product) => [product.id, product]));
        const pricedLines = input.lines.map((line) => {
          const product = productsById.get(line.productId);
          if (!product) throw new BadRequestException('Sản phẩm không hợp lệ');
          const unitPrice = Number(product.salePrice);
          if (unitPrice <= 0) {
            throw new BadRequestException(`${product.name} chưa được thiết lập giá bán`);
          }
          return {
            product,
            quantity: line.quantity,
            unitPrice,
            lineTotal: line.quantity * unitPrice,
          };
        });

        let totals;
        try {
          totals = calculateSaleTotals(pricedLines, input.discount, input.taxRate);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Tổng tiền không hợp lệ',
          );
        }

        const saleNumber = this.generateNumber('HD');
        const documentNumber = this.generateNumber('PX');
        const now = new Date();
        const document = await tx.stockDocument.create({
          data: {
            companyId,
            number: documentNumber,
            type: 'ISSUE',
            status: 'POSTED',
            warehouseId: input.warehouseId,
            reference: saleNumber,
            note: `Xuất bán tự động từ POS${input.customerName ? ` - ${input.customerName}` : ''}`,
            idempotencyKey: input.idempotencyKey,
            createdById: actorId,
            approvedById: actorId,
            approvedAt: now,
            postedAt: now,
            lines: {
              create: pricedLines.map(({ product, quantity }) => ({
                productId: product.id,
                quantity,
                unitCost: product.balances[0]?.averageCost ?? product.standardCost,
              })),
            },
          },
          include: { lines: true },
        });

        for (const line of document.lines) {
          const product = productsById.get(line.productId);
          if (!product) throw new BadRequestException('Sản phẩm không hợp lệ');
          const quantity = Number(line.quantity);
          const changed = await tx.stockBalance.updateMany({
            where: {
              warehouseId: input.warehouseId,
              productId: line.productId,
              quantity: { gte: quantity },
            },
            data: {
              quantity: { decrement: quantity },
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException(
              `Không đủ tồn kho cho ${product.name}. Vui lòng kiểm tra lại giỏ hàng`,
            );
          }
          const balance = await tx.stockBalance.findUniqueOrThrow({
            where: {
              warehouseId_productId: {
                warehouseId: input.warehouseId,
                productId: line.productId,
              },
            },
          });
          await tx.stockLedger.create({
            data: {
              companyId,
              documentId: document.id,
              documentLineId: line.id,
              warehouseId: input.warehouseId,
              productId: line.productId,
              quantityDelta: -quantity,
              unitCost: line.unitCost,
              balanceAfter: balance.quantity,
            },
          });
        }

        const sale = await tx.sale.create({
          data: {
            companyId,
            number: saleNumber,
            warehouseId: input.warehouseId,
            customerName: input.customerName || null,
            customerPhone: input.customerPhone || null,
            subtotal: totals.subtotal,
            discount: totals.discount,
            taxRate: totals.taxRate,
            taxAmount: totals.taxAmount,
            total: totals.total,
            paymentMethod: input.paymentMethod,
            idempotencyKey: input.idempotencyKey,
            stockDocumentId: document.id,
            soldById: actorId,
            soldAt: now,
            lines: {
              create: pricedLines.map(({ product, quantity, unitPrice, lineTotal }) => ({
                productId: product.id,
                quantity,
                unitPrice,
                lineTotal,
              })),
            },
          },
          include: saleReceiptInclude,
        });

        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entityType: 'Sale',
            entityId: sale.id,
            action: 'CHECKOUT',
            after: {
              number: sale.number,
              total: totals.total,
              lineCount: sale.lines.length,
              stockDocumentId: document.id,
            },
          },
        });
        return this.toReceipt(sale);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const existing = await this.prisma.sale.findFirst({
          where: { companyId, idempotencyKey: input.idempotencyKey },
          include: saleReceiptInclude,
        });
        if (existing) return this.toReceipt(existing);
      }
      throw error;
    }
  }

  private async ensureWarehouse(companyId: string, warehouseId: string): Promise<void> {
    if (!warehouseId) throw new BadRequestException('Hãy chọn kho bán hàng');
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, active: true },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundException('Không tìm thấy kho bán hàng');
  }

  private toCatalogItem(product: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    category: string;
    salePrice: Prisma.Decimal;
    reorderPoint: number;
    barcodes: Array<{ code: string }>;
    balances: Array<{ quantity: number }>;
  }): PosCatalogItem {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      barcode: product.barcodes[0]?.code,
      category: product.category,
      salePrice: Number(product.salePrice),
      stockQuantity: Number(product.balances[0]?.quantity ?? 0),
      reorderPoint: Number(product.reorderPoint),
    };
  }

  private toReceipt(sale: SaleWithReceipt): SaleReceipt {
    return {
      id: sale.id,
      number: sale.number,
      warehouseName: sale.warehouse.name,
      status: sale.status,
      customerName: sale.customerName ?? undefined,
      customerPhone: sale.customerPhone ?? undefined,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      taxRate: Number(sale.taxRate),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      paymentMethod: sale.paymentMethod,
      soldByName: sale.soldBy.fullName,
      soldAt: sale.soldAt.toISOString(),
      company: this.toCompanySettings(sale.company),
      lines: sale.lines.map((line) => ({
        productId: line.productId,
        sku: line.product.sku,
        name: line.product.name,
        unit: line.product.unit,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
      })),
    };
  }

  private toCompanySettings(company: {
    name: string;
    logoKey: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxCode: string | null;
    currencyCode: string;
    defaultTaxRate: Prisma.Decimal;
    receiptPaperSize: 'THERMAL_80' | 'A4';
    receiptFooter: string | null;
  }): CompanySettings {
    return {
      name: company.name,
      logoKey: company.logoKey ?? undefined,
      address: company.address ?? undefined,
      phone: company.phone ?? undefined,
      email: company.email ?? undefined,
      taxCode: company.taxCode ?? undefined,
      currencyCode: 'VND',
      defaultTaxRate: Number(company.defaultTaxRate),
      receiptPaperSize: company.receiptPaperSize,
      receiptFooter: company.receiptFooter ?? undefined,
    };
  }

  private generateNumber(prefix: 'HD' | 'PX'): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `${prefix}-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
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

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
