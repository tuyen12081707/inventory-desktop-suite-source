import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PageResult, ProductSummary } from '@inventory/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ProductCreateInput {
  sku: string;
  name: string;
  unit: string;
  barcode?: string;
  reorderPoint: number;
  standardCost: number;
  salePrice: number;
  category: string;
}

export type ProductUpdateInput = Partial<ProductCreateInput>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    companyId: string,
    search: string,
    page: number,
    pageSize: number,
  ): Promise<PageResult<ProductSummary>> {
    const where: Prisma.ProductWhereInput = {
      companyId,
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { barcodes: { some: { code: { contains: search } } } },
            ],
          }
        : {}),
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { barcodes: { where: { primary: true }, take: 1 }, balances: true },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        barcode: product.barcodes[0]?.code,
        reorderPoint: Number(product.reorderPoint),
        standardCost: Number(product.standardCost),
        salePrice: Number(product.salePrice),
        category: product.category,
        stockTotal: product.balances.reduce(
          (totalQuantity, balance) => totalQuantity + Number(balance.quantity),
          0,
        ),
        active: product.active,
      })),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async create(
    companyId: string,
    actorId: string,
    input: ProductCreateInput,
  ): Promise<ProductSummary> {
    try {
      const product = await this.prisma.product.create({
        data: {
          companyId,
          sku: input.sku,
          name: input.name,
          unit: input.unit,
          reorderPoint: input.reorderPoint,
          standardCost: input.standardCost,
          salePrice: input.salePrice,
          category: input.category,
          barcodes: input.barcode
            ? { create: { companyId, code: input.barcode, primary: true } }
            : undefined,
        },
        include: { barcodes: true },
      });
      const result = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        barcode: product.barcodes[0]?.code,
        reorderPoint: Number(product.reorderPoint),
        standardCost: Number(product.standardCost),
        salePrice: Number(product.salePrice),
        category: product.category,
        stockTotal: 0,
        active: product.active,
      };
      await this.prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          entityType: 'Product',
          entityId: product.id,
          action: 'CREATE',
          after: this.toJson(result),
        },
      });
      return result;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('SKU hoặc barcode đã tồn tại');
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    actorId: string,
    productId: string,
    input: ProductUpdateInput,
  ): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      include: { barcodes: { where: { primary: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy sản phẩm');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: {
            sku: input.sku,
            name: input.name,
            unit: input.unit,
            reorderPoint: input.reorderPoint,
            standardCost: input.standardCost,
            salePrice: input.salePrice,
            category: input.category,
          },
        });
        if (input.barcode !== undefined) {
          await tx.productBarcode.deleteMany({
            where: { productId, primary: true },
          });
          if (input.barcode) {
            await tx.productBarcode.create({
              data: { companyId, productId, code: input.barcode, primary: true },
            });
          }
        }
        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            entityType: 'Product',
            entityId: productId,
            action: 'UPDATE',
            before: this.toJson(this.auditShape(existing)),
            after: this.toJson(input),
          },
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('SKU hoặc barcode đã tồn tại');
      }
      throw error;
    }
  }

  async setStatus(
    companyId: string,
    actorId: string,
    productId: string,
    active: boolean,
  ): Promise<void> {
    const existing = await this.prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!existing) throw new NotFoundException('Không tìm thấy sản phẩm');
    if (!active) {
      const balance = await this.prisma.stockBalance.aggregate({
        where: { productId },
        _sum: { quantity: true },
      });
      if ((balance._sum.quantity ?? 0) > 0) {
        throw new BadRequestException(
          'Sản phẩm còn tồn kho, hãy xử lý tồn trước khi ngừng sử dụng',
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id: productId }, data: { active } }),
      this.prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          entityType: 'Product',
          entityId: productId,
          action: active ? 'ACTIVATE' : 'DEACTIVATE',
          before: this.toJson({ active: existing.active }),
          after: this.toJson({ active }),
        },
      }),
    ]);
  }

  async remove(companyId: string, actorId: string, productId: string): Promise<void> {
    const existing = await this.prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!existing) throw new NotFoundException('Không tìm thấy sản phẩm');
    const [balances, documentLines, ledgers, stocktakeLines, saleLines] =
      await this.prisma.$transaction([
        this.prisma.stockBalance.count({ where: { productId } }),
        this.prisma.stockDocumentLine.count({ where: { productId } }),
        this.prisma.stockLedger.count({ where: { productId } }),
        this.prisma.stocktakeLine.count({ where: { productId } }),
        this.prisma.saleLine.count({ where: { productId } }),
      ]);
    if (balances || documentLines || ledgers || stocktakeLines || saleLines) {
      throw new ConflictException(
        'Sản phẩm đã phát sinh tồn kho hoặc giao dịch; hãy dùng Ngừng sử dụng thay vì xóa',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id: productId } });
      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          entityType: 'Product',
          entityId: productId,
          action: 'DELETE',
          before: this.toJson(this.auditShape(existing)),
        },
      });
    });
  }

  private auditShape(product: {
    sku: string;
    name: string;
    active: boolean;
  }): Record<string, unknown> {
    return { sku: product.sku, name: product.name, active: product.active };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
