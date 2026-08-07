import { debeAvisarNovedades } from '../update-novelties';

describe('debeAvisarNovedades', () => {
  it('no avisa si no hay actualización corriendo (build embebida o Expo Go)', () => {
    expect(debeAvisarNovedades('abc', null)).toBe(false);
  });

  it('no avisa la primera vez que este código llega a un dispositivo (nada que comparar)', () => {
    expect(debeAvisarNovedades(null, 'abc')).toBe(false);
  });

  it('no avisa si la actualización corriendo es la misma que ya se vio', () => {
    expect(debeAvisarNovedades('abc', 'abc')).toBe(false);
  });

  it('avisa si la actualización corriendo es distinta a la última vista', () => {
    expect(debeAvisarNovedades('abc', 'def')).toBe(true);
  });
});
