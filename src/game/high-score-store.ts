import AsyncStorage from '@react-native-async-storage/async-storage';

import { GAME_MODES, GameMode } from './modes';

// Una puntuación por modo, no una sola global: comparar la mejor ronda de "tranqui" con la de
// "ni de coña" no significa nada, tienen dificultades muy distintas.
const storageKey = (mode: GameMode) => `memorios.highScore.${mode}`;

export async function loadHighScore(mode: GameMode): Promise<number> {
  const raw = await AsyncStorage.getItem(storageKey(mode));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadAllHighScores(): Promise<Record<GameMode, number>> {
  const entries = await Promise.all(GAME_MODES.map(async (mode) => [mode, await loadHighScore(mode)] as const));
  return Object.fromEntries(entries) as Record<GameMode, number>;
}

export async function saveHighScoreIfBetter(mode: GameMode, score: number): Promise<number> {
  const current = await loadHighScore(mode);
  if (score <= current) {
    return current;
  }
  await AsyncStorage.setItem(storageKey(mode), String(score));
  return score;
}
