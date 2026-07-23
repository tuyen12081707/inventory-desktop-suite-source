import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  StockDocumentCreateSchema,
  type AuthUser,
  type DashboardSummary,
  type StockDocumentDetail,
  type StockDocumentSummary,
} from '@inventory/contracts';
import type { z } from 'zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { InventoryService, type StockRow } from './inventory.service';

type StockDocumentCreateInput = z.infer<typeof StockDocumentCreateSchema>;

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @RequirePermissions('inventory.read')
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<DashboardSummary> {
    return this.inventoryService.dashboard(user.companyId);
  }

  @RequirePermissions('inventory.read')
  @Get('stock')
  stock(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<StockRow[]> {
    return this.inventoryService.stock(user.companyId, warehouseId);
  }

  @RequirePermissions('documents.read')
  @Get('documents')
  documents(@CurrentUser() user: AuthUser): Promise<StockDocumentSummary[]> {
    return this.inventoryService.listDocuments(user.companyId);
  }

  @RequirePermissions('documents.read')
  @Get('documents/:id')
  document(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<StockDocumentDetail> {
    return this.inventoryService.getDocument(user.companyId, id);
  }

  @RequirePermissions('documents.write')
  @Post('documents')
  createDocument(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(StockDocumentCreateSchema))
    input: StockDocumentCreateInput,
  ): Promise<StockDocumentSummary> {
    return this.inventoryService.createDocument(user.companyId, user.id, input);
  }

  @RequirePermissions('documents.approve')
  @Post('documents/:id/approve')
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.inventoryService.approve(user.companyId, user.id, id);
    return { success: true };
  }

  @RequirePermissions('documents.post')
  @Post('documents/:id/post')
  async post(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ success: true }> {
    await this.inventoryService.post(user.companyId, user.id, id);
    return { success: true };
  }
}
