import { CompanySettingsSchema } from '@inventory/contracts';
import { describe, expect, it } from 'vitest';

const baseSettings = {
  name: 'InventoryPro',
  defaultTaxRate: 8,
  receiptPaperSize: 'THERMAL_80' as const,
};

describe('CompanySettingsSchema logo', () => {
  it('accepts an HTTPS logo URL', () => {
    expect(
      CompanySettingsSchema.safeParse({
        ...baseSettings,
        logoKey: 'https://example.com/logo.png',
      }).success,
    ).toBe(true);
  });

  it('accepts a compressed raster image data URL', () => {
    expect(
      CompanySettingsSchema.safeParse({
        ...baseSettings,
        logoKey: 'data:image/webp;base64,UklGRg==',
      }).success,
    ).toBe(true);
  });

  it('rejects unsupported URL protocols and SVG data', () => {
    expect(
      CompanySettingsSchema.safeParse({
        ...baseSettings,
        logoKey: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(
      CompanySettingsSchema.safeParse({
        ...baseSettings,
        logoKey: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      }).success,
    ).toBe(false);
  });
});
