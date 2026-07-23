import { Body, Controller, Get, Post } from '@nestjs/common';
import { WarehouseCreateSchema, type AuthUser, type WarehouseSummary } from '@inventory/contracts';
import type { z } from 'zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { WarehousesService } from './warehouses.service';

type WarehouseCreateInput = z.infer<typeof WarehouseCreateSchema>;

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @RequirePermissions('warehouses.read')
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<WarehouseSummary[]> {
    return this.warehousesService.list(user.companyId);
  }

  @RequirePermissions('warehouses.write')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(WarehouseCreateSchema)) input: WarehouseCreateInput,
  ): Promise<WarehouseSummary> {
    return this.warehousesService.create(user.companyId, input);
  }
}
