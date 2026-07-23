import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  SaleCheckoutSchema,
  type AuthUser,
  type PosCatalogItem,
  type SaleReceipt,
} from '@inventory/contracts';
import type { z } from 'zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { SalesService } from './sales.service';

type CheckoutInput = z.infer<typeof SaleCheckoutSchema>;

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @RequirePermissions('sales.read')
  @Get('catalog')
  catalog(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId: string,
    @Query('search') search = '',
  ): Promise<PosCatalogItem[]> {
    return this.salesService.catalog(user.companyId, warehouseId, search.trim());
  }

  @RequirePermissions('sales.read')
  @Get('resolve')
  resolve(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId: string,
    @Query('code') code = '',
  ): Promise<PosCatalogItem> {
    return this.salesService.resolveProduct(user.companyId, warehouseId, code);
  }

  @RequirePermissions('sales.read')
  @Get('recent')
  recent(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<SaleReceipt[]> {
    return this.salesService.recent(user.companyId, warehouseId);
  }

  @RequirePermissions('sales.checkout')
  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SaleCheckoutSchema)) input: CheckoutInput,
  ): Promise<SaleReceipt> {
    return this.salesService.checkout(user.companyId, user.id, input);
  }
}
