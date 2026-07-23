import { ConflictException, Injectable } from '@nestjs/common';
import type { WarehouseSummary } from '@inventory/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

interface WarehouseCreateInput {
  code: string;
  name: string;
  address?: string;
}

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<WarehouseSummary[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { companyId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return warehouses.map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address ?? undefined,
      active: warehouse.active,
    }));
  }

  async create(companyId: string, input: WarehouseCreateInput): Promise<WarehouseSummary> {
    try {
      const warehouse = await this.prisma.warehouse.create({
        data: { companyId, ...input },
      });
      return {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address ?? undefined,
        active: warehouse.active,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Mã kho đã tồn tại');
      }
      throw error;
    }
  }
}
