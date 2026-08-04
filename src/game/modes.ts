export type GameMode = 'tranqui' | 'chunguillo' | 'nidecona';

export const GAME_MODES: readonly GameMode[] = ['tranqui', 'chunguillo', 'nidecona'];

export interface ModeConfig {
  /** Si la reproducción de la secuencia se acelera con las rondas. */
  accelerates: boolean;
  /** Si esta partida puede tener rondas invertidas (a partir de la ronda 5). */
  allowsReversal: boolean;
}

// El input nunca tiene límite de tiempo en ningún modo — lo que cambia entre modos es solo
// la velocidad de REPRODUCCIÓN de la secuencia (más difícil de memorizar) y si hay rondas
// invertidas, nunca una penalización por tardar en responder.
export const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  tranqui: { accelerates: false, allowsReversal: false },
  chunguillo: { accelerates: true, allowsReversal: false },
  nidecona: { accelerates: true, allowsReversal: true },
};

const BASE_TONE_ON_MS = 420;
const BASE_TONE_GAP_MS = 220;

// Rondas 1-3: velocidad base. Desde la 4: un escalón notable (30% más rápido — el primer
// salto tiene que notarse de golpe). Desde la 7: bastante más cada ronda, hasta un suelo.
const STEP1_ROUND = 4;
const STEP1_FACTOR = 0.7;
const STEP2_ROUND = 7;
const STEP2_DECAY_PER_ROUND = 0.05;
const MIN_FACTOR = 0.35;

function speedFactorForRound(roundNumber: number): number {
  if (roundNumber < STEP1_ROUND) return 1;
  if (roundNumber < STEP2_ROUND) return STEP1_FACTOR;
  const extraRounds = roundNumber - STEP2_ROUND + 1;
  return Math.max(MIN_FACTOR, STEP1_FACTOR - extraRounds * STEP2_DECAY_PER_ROUND);
}

export interface PlaybackTiming {
  toneOnMs: number;
  toneGapMs: number;
}

export function playbackTimingForRound(roundNumber: number, accelerates: boolean): PlaybackTiming {
  const factor = accelerates ? speedFactorForRound(roundNumber) : 1;
  return {
    toneOnMs: Math.round(BASE_TONE_ON_MS * factor),
    toneGapMs: Math.round(BASE_TONE_GAP_MS * factor),
  };
}
