import { BadRequestException, Injectable } from '@nestjs/common';
import type { ReportOverview } from '@inventory/contracts';
import { getStockLevel } from '../inventory/domain/stock-level';
import { PrismaService } from '../common/prisma/prisma.service';

interface ReportFilter {
  from?: string;
  to?: string;
  warehouseId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(companyId: string, filter: ReportFilter): Promise<ReportOverview> {
    const { from, to } = this.dateRange(filter.from, filter.to);
    if (filter.warehouseId) {
      const exists = await this.prisma.warehouse.count({
        where: { id: filter.warehouseId, companyId },
      });
      if (!exists) throw new BadRequestException('Kho lọc báo cáo không hợp lệ');
    }
    const [company, sales, balances, activeProducts, stockTotals] = await this.prisma.$transaction([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } }),
      this.prisma.sale.findMany({
        where: {
          companyId,
          status: 'COMPLETED',
          soldAt: { gte: from, lte: to },
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        include: {
          lines: { include: { product: true } },
          stockDocument: { include: { lines: true } },
        },
        orderBy: { soldAt: 'asc' },
      }),
      this.prisma.stockBalance.findMany({
        where: {
          warehouse: { companyId },
          product: { active: true },
          ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
        },
        include: { product: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, active: true },
        select: { id: true, sku: true, name: true, unit: true, reorderPoint: true },
      }),
      this.prisma.stockBalance.groupBy({
        by: ['productId'],
        where: { warehouse: { companyId }, product: { active: true } },
        orderBy: { productId: 'asc' },
        _sum: { quantity: true },
      }),
    ]);
    let revenue = 0;
    let discount = 0;
    let taxAmount = 0;
    let grossProfit = 0;
    const byDate = new Map<string, { revenue: number; invoices: number }>();
    const byProduct = new Map<
      string,
      { sku: string; name: string; quantity: number; revenue: number; grossProfit: number }
    >();
    for (const sale of sales) {
      revenue += Number(sale.subtotal) - Number(sale.discount);
      discount += Number(sale.discount);
      taxAmount += Number(sale.taxAmount);
      const date = sale.soldAt.toISOString().slice(0, 10);
      const daily = byDate.get(date) ?? { revenue: 0, invoices: 0 };
      daily.revenue += Number(sale.total);
      daily.invoices += 1;
      byDate.set(date, daily);
      const costs = new Map(
        sale.stockDocument.lines.map((line) => [line.productId, Number(line.unitCost)]),
      );
      for (const line of sale.lines) {
        const quantity = Number(line.quantity);
        const lineRevenue = Number(line.lineTotal);
        const lineProfit =
          lineRevenue - quantity * (costs.get(line.productId) ?? Number(line.product.standardCost));
        grossProfit += lineProfit;
        const product = byProduct.get(line.productId) ?? {
          sku: line.product.sku,
          name: line.product.name,
          quantity: 0,
          revenue: 0,
          grossProfit: 0,
        };
        product.quantity += quantity;
        product.revenue += lineRevenue;
        product.grossProfit += lineProfit;
        byProduct.set(line.productId, product);
      }
    }
    const totalsByProduct = new Map(activeProducts.map((product) => [product.id, 0]));
    let inventoryValue = 0;
    for (const total of stockTotals) {
      totalsByProduct.set(total.productId, Number(total._sum?.quantity ?? 0));
    }
    for (const balance of balances) {
      inventoryValue += Number(balance.quantity) * Number(balance.averageCost);
    }
    const products = new Map(activeProducts.map((product) => [product.id, product]));
    const lowStock = [...totalsByProduct.entries()].flatMap(([productId, quantity]) => {
      const product = products.get(productId);
      return product && getStockLevel(quantity, product.reorderPoint) !== 'IN_STOCK'
        ? [
            {
              productId,
              sku: product.sku,
              name: product.name,
              quantity,
              reorderPoint: product.reorderPoint,
              unit: product.unit,
            },
          ]
        : [];
    });
    return {
      companyName: company.name,
      from: from.toISOString(),
      to: to.toISOString(),
      revenue,
      discount,
      taxAmount,
      grossProfit,
      invoiceCount: sales.length,
      inventoryValue,
      lowStockProducts: lowStock.length,
      revenueSeries: [...byDate.entries()].map(([date, value]) => ({ date, ...value })),
      topProducts: [...byProduct.entries()]
        .map(([productId, value]) => ({ productId, ...value }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      lowStock: lowStock.sort((a, b) => a.quantity - b.quantity).slice(0, 20),
    };
  }

  private dateRange(fromRaw?: string, toRaw?: string): { from: Date; to: Date } {
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    const from = fromRaw ? new Date(`${fromRaw}T00:00:00.000`) : defaultFrom;
    const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : today;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to)
      throw new BadRequestException('Khoảng thời gian báo cáo không hợp lệ');
    return { from, to };
  }
}
