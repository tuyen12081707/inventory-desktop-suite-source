import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  AiSettingsUpdateSchema,
  CompanySettingsSchema,
  type AiSettings,
  type AuthUser,
  type CompanySettings,
} from '@inventory/contracts';
import type { z } from 'zod';
import { AiConfigService } from '../assistant/ai-config.service';
import { AssistantService } from '../assistant/assistant.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { SettingsService } from './settings.service';

type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>;
type AiSettingsUpdateInput = z.infer<typeof AiSettingsUpdateSchema>;

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiConfigService: AiConfigService,
    private readonly assistantService: AssistantService,
  ) {}

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

  @RequirePermissions('settings.manage')
  @Get('ai')
  aiSettings(@CurrentUser() user: AuthUser): Promise<AiSettings> {
    return this.aiConfigService.getSettings(user.companyId);
  }

  @RequirePermissions('settings.manage')
  @Patch('ai')
  updateAiSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AiSettingsUpdateSchema)) input: AiSettingsUpdateInput,
  ): Promise<AiSettings> {
    return this.aiConfigService.updateSettings(user.companyId, user.id, input);
  }

  @RequirePermissions('settings.manage')
  @Post('ai/test')
  testAiSettings(@CurrentUser() user: AuthUser): Promise<{ success: true; model: string }> {
    return this.assistantService.testConnection(user.companyId);
  }
}
