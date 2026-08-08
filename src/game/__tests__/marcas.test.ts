import { esRecord, insertarMarca, marcasDesdeGuardado, mejorMarca, MARCAS_VACIAS } from '../marcas';
import type { Marcas } from '../marcas';

describe('insertarMarca', () => {
  it('la primera partida ocupa el primer hueco', () => {
    expect(insertarMarca(MARCAS_VACIAS, 7)).toEqual([7, 0, 0]);
  });

  it('coloca cada partida en su sitio, de mayor a menor', () => {
    let marcas = insertarMarca(MARCAS_VACIAS, 7);
    marcas = insertarMarca(marcas, 12);
    marcas = insertarMarca(marcas, 9);
    expect(marcas).toEqual([12, 9, 7]);
  });

  it('descarta la peor cuando ya hay tres y llega una mejor', () => {
    expect(insertarMarca([12, 9, 7], 10)).toEqual([12, 10, 9]);
  });

  it('deja las marcas igual si la partida no entra entre las tres mejores', () => {
    expect(insertarMarca([12, 9, 7], 3)).toEqual([12, 9, 7]);
  });

  it('admite repetir la misma marca', () => {
    // Hacer 12 tres veces es mejor que hacerlo una: cuenta como constancia.
    expect(insertarMarca([12, 12, 0], 12)).toEqual([12, 12, 12]);
  });

  it('no modifica el original', () => {
    const original: Marcas = [12, 9, 7];
    insertarMarca(original, 20);
    expect(original).toEqual([12, 9, 7]);
  });

  it('una partida de 0 rondas es válida y no rompe nada', () => {
    expect(insertarMarca(MARCAS_VACIAS, 0)).toEqual([0, 0, 0]);
  });
});

describe('mejorMarca y esRecord', () => {
  it('mejorMarca devuelve la primera', () => {
    expect(mejorMarca([12, 9, 7])).toBe(12);
  });

  it('esRecord solo si supera la mejor, no si solo entra entre las tres', () => {
    expect(esRecord([12, 9, 7], 13)).toBe(true);
    expect(esRecord([12, 9, 7], 12)).toBe(false);
    expect(esRecord([12, 9, 7], 10)).toBe(false);
  });
});

describe('marcasDesdeGuardado', () => {
  it('acepta lo que guardó una versión anterior', () => {
    expect(marcasDesdeGuardado([12, 9, 7])).toEqual([12, 9, 7]);
  });

  it('rellena si vienen menos de tres', () => {
    expect(marcasDesdeGuardado([12])).toEqual([12, 0, 0]);
  });

  it('ordena aunque venga desordenado', () => {
    expect(marcasDesdeGuardado([7, 12, 9])).toEqual([12, 9, 7]);
  });

  it('tolera basura sin reventar la partida', () => {
    // Un dato corrupto en el móvil no puede tumbar el juego: se ignora lo que no valga.
    expect(marcasDesdeGuardado(null)).toEqual([0, 0, 0]);
    expect(marcasDesdeGuardado('doce')).toEqual([0, 0, 0]);
    expect(marcasDesdeGuardado([12, 'nueve', -3, null])).toEqual([12, 0, 0]);
    expect(marcasDesdeGuardado([1, 2, 3, 4, 5])).toEqual([5, 4, 3]);
  });
});
