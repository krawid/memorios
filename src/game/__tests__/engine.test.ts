import { createInitialEngineState, EngineState, expectedOrder, reduceEngine, scoreFromState } from '../engine';
import { createSeededRandom } from '../seeded-random';

const alwaysFirst = () => 0; // pickRandomDirection() con esto siempre elige 'up'

/** Devuelve los valores dados en orden, uno por llamada; para controlar varias tiradas de random() seguidas. */
function queue(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('createInitialEngineState', () => {
  it('empieza reproduciendo la secuencia con una sola dirección, nunca invertida', () => {
    const state = createInitialEngineState({ random: alwaysFirst });
    expect(state).toEqual({
      phase: 'playingSequence',
      sequence: ['up'],
      inputIndex: 0,
      reversed: false,
      allowsReversal: false,
    });
  });

  it('sin opciones, allowsReversal es false por defecto (modo tranqui)', () => {
    expect(createInitialEngineState().allowsReversal).toBe(false);
  });

  it('guarda allowsReversal aunque en la ronda 1 nunca pueda invertirse todavía', () => {
    const state = createInitialEngineState({ random: alwaysFirst, allowsReversal: true });
    expect(state.allowsReversal).toBe(true);
    expect(state.reversed).toBe(false);
  });
});

describe('reduceEngine', () => {
  it('pasa a awaitingInput cuando termina la reproducción', () => {
    const state = createInitialEngineState({ random: alwaysFirst });
    const next = reduceEngine(state, { type: 'sequencePlaybackFinished' });
    expect(next.phase).toBe('awaitingInput');
  });

  it('ignora un input mientras se está reproduciendo la secuencia', () => {
    const state = createInitialEngineState({ random: alwaysFirst });
    const next = reduceEngine(state, { type: 'input', direction: 'up' });
    expect(next).toEqual(state);
  });

  it('avanza inputIndex tras un acierto que no completa la ronda', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up', 'down'],
      inputIndex: 0,
      reversed: false,
      allowsReversal: false,
    };
    const next = reduceEngine(awaiting, { type: 'input', direction: 'up' });
    expect(next).toEqual({
      phase: 'awaitingInput',
      sequence: ['up', 'down'],
      inputIndex: 1,
      reversed: false,
      allowsReversal: false,
    });
  });

  it('en una ronda invertida, avanza con el acierto contado desde el final de la secuencia', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up', 'down', 'left'],
      inputIndex: 0,
      reversed: true,
      allowsReversal: true,
    };
    // reversed: el primer input correcto es el ÚLTIMO de la secuencia ('left'), no el primero.
    const next = reduceEngine(awaiting, { type: 'input', direction: 'left' });
    expect(next).toEqual({
      phase: 'awaitingInput',
      sequence: ['up', 'down', 'left'],
      inputIndex: 1,
      reversed: true,
      allowsReversal: true,
    });
  });

  it('al completar la ronda, añade una dirección, no invierte antes de la ronda 5', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up'],
      inputIndex: 0,
      reversed: false,
      allowsReversal: true,
    };
    // random siempre devuelve algo < REVERSAL_PROBABILITY; aun así ronda 2 no puede invertirse.
    const next = reduceEngine(awaiting, { type: 'input', direction: 'up' }, queue(0.26, 0));
    expect(next.phase).toBe('playingSequence');
    expect(next.sequence).toEqual(['up', 'down']);
    expect(next.inputIndex).toBe(0);
    expect(next.reversed).toBe(false);
  });

  it('a partir de la ronda 5, puede salir invertida si el modo lo permite y la tirada cae por debajo del umbral', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up', 'down', 'left', 'right'],
      inputIndex: 3,
      reversed: false,
      allowsReversal: true,
    };
    // Dos tiradas: una para la nueva dirección (nextSequence), otra para decidir si se invierte.
    const next = reduceEngine(awaiting, { type: 'input', direction: 'right' }, queue(0, 0.1));
    expect(next.sequence).toHaveLength(5);
    expect(next.reversed).toBe(true);
  });

  it('a partir de la ronda 5, no sale invertida si la tirada cae por encima del umbral', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up', 'down', 'left', 'right'],
      inputIndex: 3,
      reversed: false,
      allowsReversal: true,
    };
    const next = reduceEngine(awaiting, { type: 'input', direction: 'right' }, queue(0, 0.9));
    expect(next.reversed).toBe(false);
  });

  it('a partir de la ronda 5, nunca sale invertida si el modo no lo permite, aunque la tirada fuera favorable', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up', 'down', 'left', 'right'],
      inputIndex: 3,
      reversed: false,
      allowsReversal: false,
    };
    const next = reduceEngine(awaiting, { type: 'input', direction: 'right' }, queue(0, 0));
    expect(next.reversed).toBe(false);
    expect(next.allowsReversal).toBe(false);
  });

  it('pasa a gameOver ante un fallo', () => {
    const awaiting: EngineState = {
      phase: 'awaitingInput',
      sequence: ['up', 'down'],
      inputIndex: 1,
      reversed: false,
      allowsReversal: false,
    };
    const next = reduceEngine(awaiting, { type: 'input', direction: 'left' });
    expect(next.phase).toBe('gameOver');
  });

  it('ignora eventos una vez en gameOver', () => {
    const over: EngineState = {
      phase: 'gameOver',
      sequence: ['up', 'down'],
      inputIndex: 1,
      reversed: false,
      allowsReversal: false,
    };
    const next = reduceEngine(over, { type: 'input', direction: 'up' });
    expect(next).toEqual(over);
  });
});

describe('scoreFromState', () => {
  it('cuenta las rondas completadas como longitud de secuencia menos una', () => {
    const state: EngineState = {
      phase: 'gameOver',
      sequence: ['up', 'down', 'left'],
      inputIndex: 0,
      reversed: false,
      allowsReversal: false,
    };
    expect(scoreFromState(state)).toBe(2);
  });

  it('devuelve 0 si falla en la primera ronda', () => {
    const state: EngineState = {
      phase: 'gameOver',
      sequence: ['up'],
      inputIndex: 0,
      reversed: false,
      allowsReversal: false,
    };
    expect(scoreFromState(state)).toBe(0);
  });
});

describe('Pásalo: reproducibilidad con semilla', () => {
  /** Juega `rounds` rondas SIEMPRE acertando, y devuelve un rastro de {sequence, reversed}
   * tras cada ronda — es lo que tienen que coincidir entre los dos turnos de Pásalo. */
  function playRounds(random: () => number, rounds: number) {
    const trace: { sequence: string; reversed: boolean }[] = [];
    let state = createInitialEngineState({ allowsReversal: true, random });

    for (let round = 0; round < rounds; round += 1) {
      state = reduceEngine(state, { type: 'sequencePlaybackFinished' }, random);
      trace.push({ sequence: state.sequence.join(','), reversed: state.reversed });

      for (const direction of expectedOrder(state.sequence, state.reversed)) {
        state = reduceEngine(state, { type: 'input', direction }, random);
      }
    }

    return trace;
  }

  it('la misma semilla produce exactamente la misma partida completa (secuencias e invertidas)', () => {
    const traceA = playRounds(createSeededRandom(20260727), 8);
    const traceB = playRounds(createSeededRandom(20260727), 8);
    expect(traceA).toEqual(traceB);
    // Que no sea trivial: hay 8 rondas de verdad, y al menos una debería salir invertida con
    // esta semilla (si no, la comparación de "reversed" del test no estaría probando nada).
    expect(traceA).toHaveLength(8);
    expect(traceA.some((round) => round.reversed)).toBe(true);
  });

  it('semillas distintas dan partidas distintas (si no, Pásalo siempre jugaría lo mismo)', () => {
    const traceA = playRounds(createSeededRandom(1), 8);
    const traceB = playRounds(createSeededRandom(2), 8);
    expect(traceA).not.toEqual(traceB);
  });
});

describe('expectedOrder', () => {
  it('devuelve la secuencia tal cual cuando no está invertida', () => {
    expect(expectedOrder(['up', 'down', 'left'], false)).toEqual(['up', 'down', 'left']);
  });

  it('devuelve la secuencia al revés cuando sí lo está', () => {
    expect(expectedOrder(['up', 'down', 'left'], true)).toEqual(['left', 'down', 'up']);
  });

  it('no muta la secuencia original', () => {
    const sequence = ['up', 'down'] as const;
    expectedOrder(sequence, true);
    expect(sequence).toEqual(['up', 'down']);
  });
});
