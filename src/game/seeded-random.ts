/**
 * Generador pseudoaleatorio con semilla (mulberry32): dado el mismo número de semilla,
 * produce siempre la misma secuencia de valores. Existe para el modo Pásalo — los dos
 * jugadores tienen que enfrentarse a la secuencia EXACTAMENTE igual, así que no vale
 * `Math.random()` normal (no reproducible). Devuelve valores en [0, 1), igual que
 * `Math.random()`, para que encaje sin cambios con `nextSequence`/`decideReversed`.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Una semilla nueva, para arrancar una partida de Pásalo distinta cada vez. */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
