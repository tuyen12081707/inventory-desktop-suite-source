import { describe, expect, it } from 'vitest';
import { calculateSaleTotals } from './sale-policy';

describe('calculateSaleTotals', () => {
  it('calculates subtotal, discount and VAT', () => {
    expect(
      calculateSaleTotals(
        [
          { quantity: 2, unitPrice: 9_800_000 },
          { quantity: 1, unitPrice: 2_150_000 },
        ],
        500_000,
        8,
      ),
    ).toEqual({
      subtotal: 21_750_000,
      discount: 500_000,
      taxRate: 8,
      taxAmount: 1_700_000,
      total: 22_950_000,
    });
  });

  it('supports decimal quantities and rounds currency', () => {
    expect(calculateSaleTotals([{ quantity: 1.5, unitPrice: 10.15 }], 0, 8)).toEqual({
      subtotal: 15.23,
      discount: 0,
      taxRate: 8,
      taxAmount: 1.22,
      total: 16.45,
    });
  });

  it('rejects discount greater than subtotal', () => {
    expect(() => calculateSaleTotals([{ quantity: 1, unitPrice: 100 }], 101, 0)).toThrow(
      'Giảm giá không được lớn hơn tiền hàng',
    );
  });
});
