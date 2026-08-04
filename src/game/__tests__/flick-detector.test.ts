import { classifyFlick } from '../flick-detector';

describe('classifyFlick', () => {
  it('ignora un toque incidental sin desplazamiento ni velocidad', () => {
    expect(classifyFlick({ dx: 2, dy: 1, vx: 10, vy: 5 })).toBeNull();
  });

  it('ignora un arrastre lento y corto (ni rápido ni suficientemente largo)', () => {
    expect(classifyFlick({ dx: 30, dy: 0, vx: 50, vy: 0 })).toBeNull();
  });

  it('registra un flick corto pero rápido', () => {
    expect(classifyFlick({ dx: 25, dy: 0, vx: 400, vy: 0 })).toBe('right');
  });

  it('registra un arrastre lento pero largo (motricidad reducida)', () => {
    expect(classifyFlick({ dx: 65, dy: 0, vx: 20, vy: 0 })).toBe('right');
  });

  it.each([
    ['right', 100, 0],
    ['left', -100, 0],
    ['down', 0, 100],
    ['up', 0, -100],
  ] as const)('clasifica %s correctamente', (expected, dx, dy) => {
    expect(classifyFlick({ dx, dy, vx: dx * 5, vy: dy * 5 })).toBe(expected);
  });

  it('redondea un ángulo diagonal a la dirección dominante más cercana', () => {
    // 80px derecha, 20px abajo: mayoritariamente horizontal -> "right"
    expect(classifyFlick({ dx: 80, dy: 20, vx: 400, vy: 100 })).toBe('right');
  });
});
