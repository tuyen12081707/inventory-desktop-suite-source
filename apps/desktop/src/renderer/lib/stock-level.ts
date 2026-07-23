export type StockLevel = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export function getStockLevel(quantity: number, reorderPoint: number): StockLevel {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (reorderPoint > 0 && quantity <= reorderPoint) return 'LOW_STOCK';
  return 'IN_STOCK';
}
