import { Injectable, NotFoundException } from '@nestjs/common';
import type { CompanySettings, CompanySettingsInput } from '@inventory/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompany(companyId: string): Promise<CompanySettings> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Không tìm thấy doanh nghiệp');
    return this.toSettings(company);
  }

  async updateCompany(
    companyId: string,
    actorId: string,
    input: CompanySettingsInput,
  ): Promise<CompanySettings> {
    const before = await this.getCompany(companyId);
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
        logoKey: input.logoKey || null,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        taxCode: input.taxCode || null,
        defaultTaxRate: input.defaultTaxRate,
        receiptPaperSize: input.receiptPaperSize,
        receiptFooter: input.receiptFooter || null,
      },
    });
    const after = this.toSettings(company);
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        entityType: 'Company',
        entityId: companyId,
        action: 'UPDATE_SETTINGS',
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after)),
      },
    });
    return after;
  }

  private toSettings(company: {
    name: string;
    logoKey: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxCode: string | null;
    currencyCode: string;
    defaultTaxRate: { toString(): string };
    receiptPaperSize: 'THERMAL_80' | 'A4';
    receiptFooter: string | null;
  }): CompanySettings {
    return {
      name: company.name,
      logoKey: company.logoKey ?? undefined,
      address: company.address ?? undefined,
      phone: company.phone ?? undefined,
      email: company.email ?? undefined,
      taxCode: company.taxCode ?? undefined,
      currencyCode: 'VND',
      defaultTaxRate: Number(company.defaultTaxRate),
      receiptPaperSize: company.receiptPaperSize,
      receiptFooter: company.receiptFooter ?? undefined,
    };
  }
}
