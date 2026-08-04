import { Direction } from './types';

export interface FlickInput {
  /** Desplazamiento horizontal total, en puntos. Positivo = derecha. */
  dx: number;
  /** Desplazamiento vertical total, en puntos. Positivo = abajo (eje Y de RN). */
  dy: number;
  /** Velocidad horizontal al soltar, en puntos/segundo. */
  vx: number;
  /** Velocidad vertical al soltar, en puntos/segundo. */
  vy: number;
}

// Un flick se registra si es rápido aunque sea corto (MIN_DISTANCE_FAST + MIN_VELOCITY),
// o si es lento pero recorre una distancia clara (MIN_DISTANCE_SLOW) — así no excluye a
// quien no puede mover el dedo deprisa pero sí puede arrastrarlo con intención.
const MIN_DISTANCE_FAST = 24;
const MIN_VELOCITY = 300;
const MIN_DISTANCE_SLOW = 60;

export function classifyFlick({ dx, dy, vx, vy }: FlickInput): Direction | null {
  const distance = Math.hypot(dx, dy);
  const speed = Math.hypot(vx, vy);

  const committedFast = distance >= MIN_DISTANCE_FAST && speed >= MIN_VELOCITY;
  const committedSlow = distance >= MIN_DISTANCE_SLOW;

  if (!committedFast && !committedSlow) {
    return null;
  }

  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (degrees >= -45 && degrees < 45) return 'right';
  if (degrees >= 45 && degrees < 135) return 'down';
  if (degrees >= -135 && degrees < -45) return 'up';
  return 'left';
}
