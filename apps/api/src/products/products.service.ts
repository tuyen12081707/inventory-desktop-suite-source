import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(companyId: string, input: ProductCreateInput): Promise<ProductSummary> {
    try {
      const product = await this.prisma.product.create({
        data: {
          companyId,
          sku: input.sku,
          name: input.name,
          unit: input.unit,
          reorderPoint: input.reorderPoint,
          standardCost: input.standardCost,
          barcodes: input.barcode
            ? { create: { companyId, code: input.barcode, primary: true } }
            : undefined,
        },
        include: { barcodes: true },
      });
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        barcode: product.barcodes[0]?.code,
        reorderPoint: Number(product.reorderPoint),
        standardCost: Number(product.standardCost),
        stockTotal: 0,
        active: product.active,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('SKU hoặc barcode đã tồn tại');
      }
      throw error;
    }
  }

  async update(companyId: string, productId: string, input: ProductUpdateInput): Promise<void> {
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
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('SKU hoặc barcode đã tồn tại');
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
