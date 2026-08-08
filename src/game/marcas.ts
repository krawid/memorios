/**
 * Las tres mejores marcas de un modo, de mayor a menor.
 *
 * Se guardan tres y no una porque la clasificación deshace los empates con ellas: a igual mejor
 * marca gana quien tenga mejor segunda, y luego tercera. Premia la constancia sobre la partida
 * con suerte.
 *
 * Los huecos se rellenan con 0: "no he jugado una tercera vez" y "mi tercera partida fue de 0
 * rondas" ordenan igual, y a efectos de desempate significan lo mismo.
 *
 * Todo este archivo es puro: sin AsyncStorage, sin red. Así se prueba con Jest sin mocks (el
 * guardado vive aparte, en high-score-store.ts).
 */

export const CUANTAS_MARCAS = 3;

export type Marcas = [number, number, number];

export const MARCAS_VACIAS: Marcas = [0, 0, 0];

/**
 * Mete una partida nueva en la lista y devuelve las tres mejores. No modifica la lista original.
 * Si la partida no entra entre las tres mejores, devuelve las mismas de antes.
 */
export function insertarMarca(marcas: Marcas, rondas: number): Marcas {
  const todas = [...marcas, rondas].sort((a, b) => b - a).slice(0, CUANTAS_MARCAS);
  return [todas[0] ?? 0, todas[1] ?? 0, todas[2] ?? 0];
}

/** La marca que se enseña en el menú y en la clasificación. */
export function mejorMarca(marcas: Marcas): number {
  return marcas[0];
}

/** true si `rondas` mejora la mejor marca (no solo si entra en las tres). */
export function esRecord(marcas: Marcas, rondas: number): boolean {
  return rondas > marcas[0];
}

/**
 * Convierte lo que venga de AsyncStorage en unas marcas válidas. Tolera basura a propósito: es
 * un dato que lleva en el móvil desde vaya usted a saber qué versión, y una partida no se puede
 * caer porque alguien tenga algo raro guardado.
 */
export function marcasDesdeGuardado(guardado: unknown): Marcas {
  if (!Array.isArray(guardado)) return MARCAS_VACIAS;

  const validas = guardado
    .filter((valor): valor is number => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0)
    .map((valor) => Math.floor(valor))
    .sort((a, b) => b - a)
    .slice(0, CUANTAS_MARCAS);

  return [validas[0] ?? 0, validas[1] ?? 0, validas[2] ?? 0];
}
