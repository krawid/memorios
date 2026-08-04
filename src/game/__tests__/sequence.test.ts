import { nextSequence, pickRandomDirection } from '../sequence';
import { DIRECTIONS } from '../types';

describe('pickRandomDirection', () => {
  it('devuelve la primera dirección cuando random() es 0', () => {
    expect(pickRandomDirection(() => 0)).toBe(DIRECTIONS[0]);
  });

  it('devuelve la última dirección cuando random() está justo por debajo de 1', () => {
    expect(pickRandomDirection(() => 0.9999)).toBe(DIRECTIONS[DIRECTIONS.length - 1]);
  });

  it('solo devuelve direcciones válidas', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(DIRECTIONS).toContain(pickRandomDirection());
    }
  });
});

describe('nextSequence', () => {
  it('añade una dirección más sin mutar la secuencia original', () => {
    const original = ['up' as const];
    const result = nextSequence(original, () => 0);

    expect(result).toEqual(['up', 'up']);
    expect(original).toEqual(['up']);
  });

  it('parte de una secuencia vacía', () => {
    expect(nextSequence([], () => 0.5)).toHaveLength(1);
  });
});
