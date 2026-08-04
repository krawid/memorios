import { GameMode } from '@/game/modes';

export const MODE_LABELS: Record<GameMode, string> = {
  tranqui: 'Modo tranqui',
  chunguillo: 'Modo chunguillo',
  nidecona: 'Modo ni de coña',
};

export const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  tranqui: 'El juego normal, sin prisas ni sorpresas.',
  chunguillo: 'Como el tranqui, pero la secuencia se acelera a partir de la ronda 4, y más desde la 7.',
  nidecona: 'Como el chunguillo, y además puede tocar repetir alguna ronda al revés a partir de la 5.',
};
