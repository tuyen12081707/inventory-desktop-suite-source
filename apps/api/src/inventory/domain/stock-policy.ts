import type { DocumentType } from '@inventory/contracts';

export interface MovementDelta {
  target: 'source' | 'destination';
  delta: number;
}

export function movementDeltas(type: DocumentType, quantity: number): MovementDelta[] {
  if (!Number.isFinite(quantity) || quantity === 0) {
    throw new Error('Quantity must be a non-zero finite number');
  }

  switch (type) {
    case 'RECEIPT':
      return [{ target: 'source', delta: Math.abs(quantity) }];
    case 'ISSUE':
      return [{ target: 'source', delta: -Math.abs(quantity) }];
    case 'TRANSFER':
      return [
        { target: 'source', delta: -Math.abs(quantity) },
        { target: 'destination', delta: Math.abs(quantity) },
      ];
    case 'ADJUSTMENT':
      return [{ target: 'source', delta: quantity }];
    default:
      throw new Error(`Unsupported document type: ${String(type)}`);
  }
}
