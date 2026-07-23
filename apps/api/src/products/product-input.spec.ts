import { ProductCreateSchema, ProductUpdateSchema } from '@inventory/contracts';
import { describe, expect, it } from 'vitest';

const product = {
  sku: 'sp-001',
  name: 'Sản phẩm thử',
  unit: 'cái',
  reorderPoint: 5,
  standardCost: 10_000,
  salePrice: 15_000,
  category: 'Thử nghiệm',
};

describe('product inventory input', () => {
  it('defaults opening stock to zero', () => {
    const result = ProductCreateSchema.parse(product);

    expect(result.openingQuantity).toBe(0);
    expect(result.openingWarehouseId).toBeUndefined();
  });

  it('requires a warehouse when opening stock is positive', () => {
    const result = ProductCreateSchema.safeParse({
      ...product,
      openingQuantity: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['openingWarehouseId']);
  });

  it('accepts integer opening stock with a warehouse', () => {
    const result = ProductCreateSchema.parse({
      ...product,
      openingQuantity: 12,
      openingWarehouseId: '0d7de7c1-d00c-4f1f-87d2-e3e4ec97bab5',
    });

    expect(result.openingQuantity).toBe(12);
  });

  it('keeps opening stock out of product updates', () => {
    const result = ProductUpdateSchema.parse({
      name: 'Tên mới',
      openingQuantity: 99,
    });

    expect(result).toEqual({ name: 'Tên mới' });
  });
});
