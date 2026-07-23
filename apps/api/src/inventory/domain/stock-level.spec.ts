import { describe, expect, it } from 'vitest';
import { getStockLevel } from './stock-level';

describe('getStockLevel', () => {
  it('marks zero and negative stock as out of stock regardless of the threshold', () => {
    expect(getStockLevel(0, 0)).toBe('OUT_OF_STOCK');
    expect(getStockLevel(-2, 10)).toBe('OUT_OF_STOCK');
  });

  it('disables the low-stock warning when the threshold is zero', () => {
    expect(getStockLevel(1, 0)).toBe('IN_STOCK');
    expect(getStockLevel(5, 0)).toBe('IN_STOCK');
  });

  it('compares each product quantity with its own positive threshold', () => {
    expect(getStockLevel(5, 10)).toBe('LOW_STOCK');
    expect(getStockLevel(10, 10)).toBe('LOW_STOCK');
    expect(getStockLevel(11, 10)).toBe('IN_STOCK');
    expect(getStockLevel(10_000, 10)).toBe('IN_STOCK');
  });
});
