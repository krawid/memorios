import { Direction } from './types';

export type InputResult =
  | { outcome: 'correct'; roundComplete: boolean }
  | { outcome: 'incorrect'; expected: Direction };

export function evaluateInput(
  sequence: readonly Direction[],
  inputIndex: number,
  input: Direction,
  reversed = false,
): InputResult {
  const expectedIndex = reversed ? sequence.length - 1 - inputIndex : inputIndex;
  const expected = sequence[expectedIndex];

  if (input !== expected) {
    return { outcome: 'incorrect', expected };
  }

  return { outcome: 'correct', roundComplete: inputIndex === sequence.length - 1 };
}
