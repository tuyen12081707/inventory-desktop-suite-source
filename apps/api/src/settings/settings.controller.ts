import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CompanySettingsSchema, type AuthUser, type CompanySettings } from '@inventory/contracts';
import type { z } from 'zod';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { SettingsService } from './settings.service';

type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>;

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @RequirePermissions('settings.manage')
  @Get('company')
  company(@CurrentUser() user: AuthUser): Promise<CompanySettings> {
    return this.settingsService.getCompany(user.companyId);
  }

  @RequirePermissions('settings.manage')
  @Patch('company')
  updateCompany(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CompanySettingsSchema)) input: CompanySettingsInput,
  ): Promise<CompanySettings> {
    return this.settingsService.updateCompany(user.companyId, user.id, input);
  }
}
