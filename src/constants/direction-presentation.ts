import { Direction } from '@/game/types';

export const DIRECTION_COLOR_NAMES: Record<Direction, string> = {
  up: 'rojo',
  down: 'azul',
  left: 'verde',
  right: 'amarillo',
};

export const DIRECTION_HEX_COLORS: Record<Direction, string> = {
  up: '#C13A46', // rojo algo más oscuro que un rojo "puro": con blanco encima da 5.30:1
  down: '#3A6EA5', // 5.31:1 con blanco
  left: '#278049', // verde algo más oscuro: 4.92:1 con blanco
  right: '#E0A800', // amarillo brillante — con blanco da solo 2.15:1, ver DIRECTION_TEXT_ON_COLOR
};

/**
 * Color del texto/glifo sobre cada pad. No es el mismo para las cuatro: un amarillo lo
 * bastante brillante para leerse como "amarillo" nunca llega a 4.5:1 (mínimo WCAG AA para
 * texto normal) con texto blanco encima — 2.15:1, muy por debajo incluso del mínimo de 3:1
 * para texto grande. Con texto negro da 9.77:1. Verificado calculando el contraste real
 * (fórmula de luminancia relativa de WCAG), no a ojo.
 */
export const DIRECTION_TEXT_ON_COLOR: Record<Direction, string> = {
  up: '#FFFFFF',
  down: '#FFFFFF',
  left: '#FFFFFF',
  right: '#000000',
};

export const DIRECTION_GLYPHS: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

/**
 * Direcciones de más grave a más aguda, que es el orden en que conviene presentarlas al
 * aprenderlas: recorrer la lista hace sonar la escalera entera y la regla ("cuanto más arriba
 * está el pad, más agudo suena") se oye sola. `DIRECTIONS` mantiene su propio orden porque es
 * el que usa el motor del juego para generar secuencias.
 */
export const DIRECTIONS_BY_PITCH: readonly Direction[] = ['down', 'left', 'right', 'up'];

export const DIRECTION_SPOKEN_NAME: Record<Direction, string> = {
  up: 'arriba',
  down: 'abajo',
  left: 'izquierda',
  right: 'derecha',
};
