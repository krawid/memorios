import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { GAME_MODES, GameMode } from '@/game/modes';
import { createRandomSeed } from '@/game/seeded-random';
import { useAccessibilityFocus } from '@/lib/use-accessibility-focus';

// VoiceOver anuncia por su cuenta el cambio de pantalla; si hablamos a la vez, se come el
// mensaje. Un respiro corto basta para que se oigan los dos (ver guía §7.8).
const ANNOUNCE_DELAY_MS = 500;

function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && (GAME_MODES as readonly string[]).includes(value);
}

function roundsText(score: number): string {
  return score === 0 ? '0 rondas' : `${score} ${score === 1 ? 'ronda' : 'rondas'}`;
}

export default function PasaloResultadoScreen() {
  const router = useRouter();
  const { mode: modeParam, player1Score: p1Param, player2Score: p2Param } = useLocalSearchParams<{
    mode?: string;
    player1Score?: string;
    player2Score?: string;
  }>();

  const mode: GameMode = isGameMode(modeParam) ? modeParam : 'tranqui';
  const player1Score = Number.parseInt(p1Param ?? '0', 10) || 0;
  const player2Score = Number.parseInt(p2Param ?? '0', 10) || 0;

  const winnerText =
    player1Score === player2Score
      ? 'Empate'
      : player1Score > player2Score
        ? 'Gana el Jugador 1'
        : 'Gana el Jugador 2';

  useEffect(() => {
    const summary = `Resultado de pásalo, ${MODE_LABELS[mode]}. Jugador 1: ${roundsText(player1Score)}. Jugador 2: ${roundsText(player2Score)}. ${winnerText}.`;

    const timeout = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(summary);
    }, ANNOUNCE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [mode, player1Score, player2Score, winnerText]);

  // Misma razón que en pasalo-turno.tsx: sin cabecera nativa, VoiceOver no tiene dónde
  // posarse al entrar. El anuncio de arriba dice el contenido, pero no fija por dónde sigue
  // la navegación por gestos a partir de ahí — esto sí lo hace.
  const titleRef = useAccessibilityFocus(`${mode}-${player1Score}-${player2Score}`);

  function handlePlayAgain() {
    router.replace({
      pathname: '/pasalo-turno',
      params: { mode, seed: String(createRandomSeed()), player: '1' },
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.summary}>
          <ThemedText ref={titleRef} type="title" accessibilityRole="header">
            Resultado de pásalo
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.modeLabel}>
            {MODE_LABELS[mode]}
          </ThemedText>

          <ThemedView style={styles.scoreRow}>
            <ThemedText type="subtitle" style={styles.scoreLabel}>
              Jugador 1
            </ThemedText>
            <ThemedText type="subtitle">{roundsText(player1Score)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.scoreRow}>
            <ThemedText type="subtitle" style={styles.scoreLabel}>
              Jugador 2
            </ThemedText>
            <ThemedText type="subtitle">{roundsText(player2Score)}</ThemedText>
          </ThemedView>

          <ThemedText type="subtitle" style={styles.winner}>
            {winnerText}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.actions}>
          <Pressable
            onPress={handlePlayAgain}
            accessibilityRole="button"
            accessibilityLabel={`Jugar otra vez en ${MODE_LABELS[mode].toLowerCase()}`}
            style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.buttonPressed]}
          >
            <ThemedText type="subtitle" style={styles.buttonTextPrimary}>
              Jugar otra vez
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
  modeLabel: {
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  scoreLabel: {
    minWidth: 100,
  },
  winner: {
    marginTop: Spacing.three,
    textAlign: 'center',
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
