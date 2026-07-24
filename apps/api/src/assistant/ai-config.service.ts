import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AiSettings } from '@inventory/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { env } from '../config/env';
import { decryptApiKeys, encryptApiKeys } from './secret-cipher';

export interface AiSettingsUpdateInput {
  enabled: boolean;
  model: string;
  apiKeys?: string[];
}

export interface AiRuntimeConfig {
  model: string;
  apiKeys: string[];
}

@Injectable()
export class AiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(companyId: string): Promise<AiSettings> {
    const config = await this.prisma.aiAssistantConfig.findUnique({ where: { companyId } });
    if (!config) {
      return {
        provider: 'GEMINI',
        enabled: false,
        model: 'gemini-3.6-flash',
        keyCount: 0,
        maskedKeys: [],
      };
    }
    const apiKeys = config.encryptedApiKeys ? this.decrypt(config.encryptedApiKeys) : [];
    return {
      provider: 'GEMINI',
      enabled: config.enabled,
      model: config.model,
      keyCount: apiKeys.length,
      maskedKeys: apiKeys.map((key) => this.maskKey(key)),
      lastVerifiedAt: config.lastVerifiedAt?.toISOString(),
    };
  }

  async updateSettings(
    companyId: string,
    actorId: string,
    input: AiSettingsUpdateInput,
  ): Promise<AiSettings> {
    const existing = await this.prisma.aiAssistantConfig.findUnique({ where: { companyId } });
    const currentKeys = existing?.encryptedApiKeys ? this.decrypt(existing.encryptedApiKeys) : [];
    const nextKeys =
      input.apiKeys === undefined
        ? currentKeys
        : [...new Set(input.apiKeys.map((key) => key.trim()).filter(Boolean))];
    if (nextKeys.length > 20) {
      throw new BadRequestException('Chỉ hỗ trợ tối đa 20 API key Gemini');
    }
    if (input.enabled && nextKeys.length === 0) {
      throw new BadRequestException('Cần ít nhất một API key để bật chatbot');
    }

    const encryptedApiKeys =
      nextKeys.length > 0 ? encryptApiKeys(nextKeys, this.encryptionSecret) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.aiAssistantConfig.upsert({
        where: { companyId },
        create: {
          companyId,
          enabled: input.enabled,
          model: input.model,
          encryptedApiKeys,
          keyCount: nextKeys.length,
        },
        update: {
          enabled: input.enabled,
          model: input.model,
          encryptedApiKeys,
          keyCount: nextKeys.length,
          ...(input.apiKeys !== undefined ? { lastVerifiedAt: null } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          entityType: 'AiAssistantConfig',
          entityId: companyId,
          action: 'UPDATE_AI_SETTINGS',
          before: this.toJson({
            enabled: existing?.enabled ?? false,
            model: existing?.model ?? 'gemini-3.6-flash',
            keyCount: currentKeys.length,
          }),
          after: this.toJson({
            enabled: input.enabled,
            model: input.model,
            keyCount: nextKeys.length,
          }),
        },
      });
    });
    return this.getSettings(companyId);
  }

  async getRuntimeConfig(companyId: string): Promise<AiRuntimeConfig> {
    const config = await this.prisma.aiAssistantConfig.findUnique({ where: { companyId } });
    if (!config?.enabled) {
      throw new ServiceUnavailableException(
        'Chatbot chưa được bật. Quản trị viên có thể cấu hình tại Cài đặt.',
      );
    }
    const apiKeys = config.encryptedApiKeys ? this.decrypt(config.encryptedApiKeys) : [];
    if (apiKeys.length === 0) {
      throw new ServiceUnavailableException('Chatbot chưa có API key Gemini');
    }
    return { model: config.model, apiKeys };
  }

  async markVerified(companyId: string): Promise<void> {
    await this.prisma.aiAssistantConfig.updateMany({
      where: { companyId },
      data: { lastVerifiedAt: new Date() },
    });
  }

  private get encryptionSecret(): string {
    return env.AI_SECRETS_ENCRYPTION_KEY ?? env.JWT_ACCESS_SECRET;
  }

  private decrypt(payload: string): string[] {
    try {
      return decryptApiKeys(payload, this.encryptionSecret);
    } catch {
      throw new ServiceUnavailableException(
        'Không thể giải mã cấu hình AI. Hãy nhập lại API key tại Cài đặt.',
      );
    }
  }

  private maskKey(apiKey: string): string {
    if (apiKey.length < 10) return '••••••••';
    return `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
