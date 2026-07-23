import { StockDocumentCreateSchema } from '@inventory/contracts';
import { describe, expect, it } from 'vitest';

const sourceWarehouseId = '11e9c8b8-9238-4bf8-8a17-5bac2d24c451';
const destinationWarehouseId = '5ec45f55-a93e-4828-83e4-1467fd2b9564';
const baseDocument = {
  warehouseId: sourceWarehouseId,
  idempotencyKey: '6ad5a298-b1a1-4aad-a697-2807b102ed4f',
  lines: [
    {
      productId: 'c973eb13-10b2-40ef-8bb0-99b523883983',
      quantity: 5,
      unitCost: 10_000,
    },
  ],
};

describe('stock document warehouse input', () => {
  it('accepts one warehouse for a receipt', () => {
    const result = StockDocumentCreateSchema.safeParse({
      ...baseDocument,
      type: 'RECEIPT',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a destination warehouse for non-transfer documents', () => {
    const result = StockDocumentCreateSchema.safeParse({
      ...baseDocument,
      type: 'ISSUE',
      destinationWarehouseId,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['destinationWarehouseId']);
  });

  it('requires different source and destination warehouses for a transfer', () => {
    const result = StockDocumentCreateSchema.safeParse({
      ...baseDocument,
      type: 'TRANSFER',
      destinationWarehouseId: sourceWarehouseId,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.message.includes('phải khác nhau'))).toBe(
      true,
    );
  });

  it('accepts a transfer between two warehouses', () => {
    const result = StockDocumentCreateSchema.safeParse({
      ...baseDocument,
      type: 'TRANSFER',
      destinationWarehouseId,
    });

    expect(result.success).toBe(true);
  });
});
