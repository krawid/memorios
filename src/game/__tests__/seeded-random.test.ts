import { createRandomSeed, createSeededRandom } from '../seeded-random';

describe('createSeededRandom', () => {
  it('la misma semilla produce siempre la misma secuencia de valores', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const valuesA = Array.from({ length: 10 }, () => a());
    const valuesB = Array.from({ length: 10 }, () => b());
    expect(valuesA).toEqual(valuesB);
  });

  it('semillas distintas producen secuencias distintas', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const valuesA = Array.from({ length: 10 }, () => a());
    const valuesB = Array.from({ length: 10 }, () => b());
    expect(valuesA).not.toEqual(valuesB);
  });

  it('todos los valores caen en [0, 1), igual que Math.random()', () => {
    const random = createSeededRandom(123);
    for (let i = 0; i < 500; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('no repite siempre el mismo valor (comprobación básica de variedad)', () => {
    const random = createSeededRandom(7);
    const values = new Set(Array.from({ length: 20 }, () => random()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('createRandomSeed', () => {
  it('devuelve un entero no negativo', () => {
    const seed = createRandomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });
});
