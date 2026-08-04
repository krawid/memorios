import { DIRECTIONS, Direction } from './types';

export function pickRandomDirection(random: () => number = Math.random): Direction {
  const index = Math.floor(random() * DIRECTIONS.length);
  return DIRECTIONS[index];
}

export function nextSequence(current: readonly Direction[], random?: () => number): Direction[] {
  return [...current, pickRandomDirection(random)];
}
