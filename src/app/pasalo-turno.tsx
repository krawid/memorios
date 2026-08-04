import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { GAME_MODES, GameMode } from '@/game/modes';
import { useAccessibilityFocus } from '@/lib/use-accessibility-focus';

function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && (GAME_MODES as readonly string[]).includes(value);
}

export default function PasaloTurnoScreen() {
  const router = useRouter();
  const { mode: modeParam, seed, player, player1Score } = useLocalSearchParams<{
    mode?: string;
    seed?: string;
    player?: string;
    player1Score?: string;
  }>();

  const mode: GameMode = isGameMode(modeParam) ? modeParam : 'tranqui';
  const isPlayerTwo = player === '2';

  function handleStart() {
    router.replace({
      pathname: '/game',
      params: {
        mode,
        seed,
        pasaloPlayer: isPlayerTwo ? '2' : '1',
        ...(isPlayerTwo ? { player1Score } : {}),
      },
    });
  }

  const title = isPlayerTwo ? 'Turno del Jugador 2' : 'Turno del Jugador 1';
  const body = isPlayerTwo
    ? `Vas a enfrentarte a la misma secuencia exacta que jugó el Jugador 1, en ${MODE_LABELS[mode].toLowerCase()}. No sabes todavía cuánto llegó — eso se ve al final.`
    : `Vais a jugar ${MODE_LABELS[mode].toLowerCase()} los dos, con la misma secuencia. Cuando termines tu turno, le pasas el teléfono al Jugador 2.`;

  // Esta pantalla no tiene cabecera nativa (ver _layout.tsx), así que VoiceOver no tiene
  // ningún sitio fiable donde posarse al entrar. `title` como clave: si se pasa del turno 1
  // al 2 sin desmontar (replace sobre la misma ruta), esto vuelve a fijar el foco igual.
  const titleRef = useAccessibilityFocus(title);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>
          <ThemedText ref={titleRef} type="title" style={styles.title} accessibilityRole="header">
            {title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {body}
          </ThemedText>
        </ThemedView>

        <Pressable
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel={`${title}. Toca cuando estés listo para empezar`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <ThemedText type="subtitle" style={styles.buttonText}>
            Toca cuando estés listo
          </ThemedText>
        </Pressable>
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
    paddingVertical: Spacing.five,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    maxWidth: 340,
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#3A6EA5',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});
