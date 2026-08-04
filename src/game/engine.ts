import { evaluateInput } from './round-evaluator';
import { nextSequence } from './sequence';
import { Direction } from './types';

export type EnginePhase = 'playingSequence' | 'awaitingInput' | 'gameOver';

export interface EngineState {
  phase: EnginePhase;
  sequence: Direction[];
  inputIndex: number;
  /** Si es true, hay que repetir `sequence` en orden inverso para acertar esta ronda. */
  reversed: boolean;
  /** Fijado al crear la partida (viene del modo elegido); si es false, nunca hay invertidas. */
  allowsReversal: boolean;
}

export type EngineEvent = { type: 'sequencePlaybackFinished' } | { type: 'input'; direction: Direction };

// Las rondas 1-4 nunca son invertidas: dan tiempo a coger soltura con el gesto antes de
// añadir la vuelta de tuerca. A partir de la 5, cada ronda tiene esta probabilidad de serlo
// (y solo si el modo elegido lo permite, ver `allowsReversal`).
const MIN_ROUND_FOR_REVERSAL = 5;
const REVERSAL_PROBABILITY = 0.35;

function decideReversed(roundNumber: number, allowsReversal: boolean, random: () => number): boolean {
  if (!allowsReversal || roundNumber < MIN_ROUND_FOR_REVERSAL) return false;
  return random() < REVERSAL_PROBABILITY;
}

export interface CreateEngineOptions {
  allowsReversal?: boolean;
  random?: () => number;
}

export function createInitialEngineState(options: CreateEngineOptions = {}): EngineState {
  const { allowsReversal = false, random = Math.random } = options;
  const sequence = nextSequence([], random);
  return {
    phase: 'playingSequence',
    sequence,
    inputIndex: 0,
    reversed: decideReversed(sequence.length, allowsReversal, random),
    allowsReversal,
  };
}

export function reduceEngine(
  state: EngineState,
  event: EngineEvent,
  random: () => number = Math.random,
): EngineState {
  if (state.phase === 'playingSequence') {
    if (event.type === 'sequencePlaybackFinished') {
      return { ...state, phase: 'awaitingInput' };
    }
    return state;
  }

  if (state.phase === 'awaitingInput') {
    if (event.type !== 'input') {
      return state;
    }

    const result = evaluateInput(state.sequence, state.inputIndex, event.direction, state.reversed);

    if (result.outcome === 'incorrect') {
      return { ...state, phase: 'gameOver' };
    }

    if (result.roundComplete) {
      const sequence = nextSequence(state.sequence, random);
      return {
        phase: 'playingSequence',
        sequence,
        inputIndex: 0,
        reversed: decideReversed(sequence.length, state.allowsReversal, random),
        allowsReversal: state.allowsReversal,
      };
    }

    return { ...state, inputIndex: state.inputIndex + 1 };
  }

  return state;
}

/** Rondas completadas con éxito. Válido en cualquier fase, más útil al terminar la partida. */
export function scoreFromState(state: EngineState): number {
  return state.sequence.length - 1;
}

/** El orden que había que repetir de verdad: la secuencia tal cual, o al revés si tocaba. */
export function expectedOrder(sequence: readonly Direction[], reversed: boolean): Direction[] {
  return reversed ? [...sequence].reverse() : [...sequence];
}
