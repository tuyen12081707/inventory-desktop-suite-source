export interface SaleTotals {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export function calculateSaleTotals(
  lines: Array<{ quantity: number; unitPrice: number }>,
  discount: number,
  taxRate: number,
): SaleTotals {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  if (discount > subtotal) {
    throw new Error('Giảm giá không được lớn hơn tiền hàng');
  }
  const taxableAmount = subtotal - discount;
  const taxAmount = roundMoney((taxableAmount * taxRate) / 100);
  return {
    subtotal,
    discount: roundMoney(discount),
    taxRate,
    taxAmount,
    total: roundMoney(taxableAmount + taxAmount),
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
