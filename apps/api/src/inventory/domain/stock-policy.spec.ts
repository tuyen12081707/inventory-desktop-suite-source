import { describe, expect, it } from 'vitest';
import { movementDeltas } from './stock-policy';

describe('movementDeltas', () => {
  it('receives stock into the source warehouse', () => {
    expect(movementDeltas('RECEIPT', 5)).toEqual([{ target: 'source', delta: 5 }]);
  });

  it('issues stock from the source warehouse', () => {
    expect(movementDeltas('ISSUE', 5)).toEqual([{ target: 'source', delta: -5 }]);
  });

  it('creates balanced transfer movements', () => {
    const movements = movementDeltas('TRANSFER', 5);
    expect(movements).toEqual([
      { target: 'source', delta: -5 },
      { target: 'destination', delta: 5 },
    ]);
    expect(movements.reduce((sum, movement) => sum + movement.delta, 0)).toBe(0);
  });

  it('preserves the signed adjustment quantity', () => {
    expect(movementDeltas('ADJUSTMENT', -2)).toEqual([{ target: 'source', delta: -2 }]);
  });

  it('rejects zero quantity', () => {
    expect(() => movementDeltas('RECEIPT', 0)).toThrow();
  });
});
