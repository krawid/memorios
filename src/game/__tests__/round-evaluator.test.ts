import { evaluateInput } from '../round-evaluator';
import { Direction } from '../types';

const sequence: Direction[] = ['up', 'right', 'down'];

describe('evaluateInput', () => {
  it('marca correcto y ronda no completa cuando acierta un paso intermedio', () => {
    expect(evaluateInput(sequence, 0, 'up')).toEqual({ outcome: 'correct', roundComplete: false });
  });

  it('marca correcto y ronda completa cuando acierta el último paso', () => {
    expect(evaluateInput(sequence, 2, 'down')).toEqual({ outcome: 'correct', roundComplete: true });
  });

  it('marca incorrecto e indica qué dirección se esperaba', () => {
    expect(evaluateInput(sequence, 1, 'left')).toEqual({ outcome: 'incorrect', expected: 'right' });
  });

  it('funciona con una secuencia de un solo elemento', () => {
    expect(evaluateInput(['left'], 0, 'left')).toEqual({ outcome: 'correct', roundComplete: true });
  });

  describe('con reversed=true', () => {
    it('el primer input correcto es el último elemento de la secuencia', () => {
      expect(evaluateInput(sequence, 0, 'down', true)).toEqual({ outcome: 'correct', roundComplete: false });
    });

    it('el último input correcto es el primer elemento de la secuencia', () => {
      expect(evaluateInput(sequence, 2, 'up', true)).toEqual({ outcome: 'correct', roundComplete: true });
    });

    it('marca incorrecto si se responde en el orden normal en vez de invertido', () => {
      expect(evaluateInput(sequence, 0, 'up', true)).toEqual({ outcome: 'incorrect', expected: 'down' });
    });
  });
});
