import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser, ReportOverview } from '@inventory/contracts';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermissions('reports.read')
  @Get('overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<ReportOverview> {
    return this.reportsService.overview(user.companyId, { from, to, warehouseId });
  }
}
