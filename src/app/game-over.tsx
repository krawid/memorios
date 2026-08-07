import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DIRECTION_SPOKEN_NAME } from '@/constants/direction-presentation';
import { MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { GAME_MODES, GameMode } from '@/game/modes';
import { DIRECTIONS, Direction } from '@/game/types';

// VoiceOver anuncia por su cuenta el cambio de pantalla; si hablamos a la vez, se come el
// mensaje. Un respiro corto basta para que se oigan los dos (ver guía §7.8).
const ANNOUNCE_DELAY_MS = 500;

function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && (GAME_MODES as readonly string[]).includes(value);
}

export default function GameOverScreen() {
  const router = useRouter();
  const {
    mode: modeParam,
    score: scoreParam,
    sequence: sequenceParam,
    reversed: reversedParam,
  } = useLocalSearchParams<{
    mode?: string;
    score?: string;
    sequence?: string;
    reversed?: string;
  }>();
  const mode: GameMode = isGameMode(modeParam) ? modeParam : 'tranqui';
  const score = Number.parseInt(scoreParam ?? '0', 10) || 0;
  const reversed = reversedParam === '1';

  // `sequence` ya llega en el orden que había que responder de verdad (invertido si tocaba,
  // ver game.tsx), no en el de generación — es el orden que explica el fallo.
  const sequence = (sequenceParam ?? '')
    .split(',')
    .filter((step): step is Direction => DIRECTIONS.includes(step as Direction));
  const spokenSequence = sequence.map((step) => DIRECTION_SPOKEN_NAME[step]).join(', ');

  useEffect(() => {
    const summary =
      score === 0
        ? `Fin de la partida en ${MODE_LABELS[mode]}. No completaste ninguna ronda.`
        : `Fin de la partida en ${MODE_LABELS[mode]}. Completaste ${score} ${score === 1 ? 'ronda' : 'rondas'}.`;
    const reversedNote = reversed ? ' Era una ronda invertida.' : '';
    const detail = spokenSequence ? ` Había que repetir: ${spokenSequence}.` : '';

    const timeout = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(summary + reversedNote + detail);
    }, ANNOUNCE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [score, reversed, spokenSequence, mode]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.summary}>
          <ThemedText type="title" accessibilityRole="header">
            Fin de la partida
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sequence}>
            {MODE_LABELS[mode]}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.score}>
            {score === 0 ? 'No se completó ninguna ronda' : `${score} ${score === 1 ? 'ronda' : 'rondas'}`}
          </ThemedText>
          {reversed ? (
            <ThemedText themeColor="textSecondary" style={styles.sequence}>
              Era una ronda invertida
            </ThemedText>
          ) : null}
          {spokenSequence ? (
            <ThemedText themeColor="textSecondary" style={styles.sequence}>
              Había que repetir: {spokenSequence}
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.actions}>
          <Pressable
            onPress={() => router.replace({ pathname: '/game', params: { mode } })}
            accessibilityRole="button"
            accessibilityLabel={`Volver a jugar en ${MODE_LABELS[mode].toLowerCase()}`}
            style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.buttonPressed]}
          >
            <ThemedText type="subtitle" style={styles.buttonTextPrimary}>
              Volver a jugar
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Volver al menú principal"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <ThemedText type="subtitle" style={styles.buttonText}>
              Menú principal
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    paddingVertical: Spacing.five,
  },
  summary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  score: {
    textAlign: 'center',
  },
  sequence: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
  actions: {
    gap: Spacing.three,
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#E0E1E6',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#3A6EA5',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 20,
  },
  buttonTextPrimary: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});
