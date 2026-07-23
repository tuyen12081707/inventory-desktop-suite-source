import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  type AuthUser,
  type PageResult,
  type ProductSummary,
} from '@inventory/contracts';
import type { z } from 'zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { ProductsService } from './products.service';

type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @RequirePermissions('products.read')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search = '',
    @Query('page') pageRaw = '1',
    @Query('pageSize') pageSizeRaw = '25',
  ): Promise<PageResult<ProductSummary>> {
    const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw, 10) || 25));
    return this.productsService.list(user.companyId, search.trim(), page, pageSize);
  }

  @RequirePermissions('products.write')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ProductCreateSchema)) input: ProductCreateInput,
  ): Promise<ProductSummary> {
    return this.productsService.create(user.companyId, input);
  }

  @RequirePermissions('products.write')
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProductUpdateSchema)) input: ProductUpdateInput,
  ): Promise<{ success: true }> {
    await this.productsService.update(user.companyId, id, input);
    return { success: true };
  }
}
