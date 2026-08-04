import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODE_DESCRIPTIONS, MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { loadAllHighScores } from '@/game/high-score-store';
import { GAME_MODES, GameMode } from '@/game/modes';
import { createRandomSeed } from '@/game/seeded-random';

export default function MenuScreen() {
  const router = useRouter();
  const [highScores, setHighScores] = useState<Record<GameMode, number> | null>(null);
  const [pasaloModalVisible, setPasaloModalVisible] = useState(false);
  const pendingPasaloMode = useRef<GameMode | null>(null);

  // En iOS NO se navega al elegir modo: se navega en el onDismiss del Modal, cuando ya ha
  // terminado de cerrarse. Razón (verificada en el código nativo del Modal de RN,
  // RCTModalHostViewComponentView.mm): al completarse el cierre, iOS RESTAURA el foco de
  // VoiceOver al elemento que estaba enfocado antes de abrir el modal (el botón del menú).
  // Si navegamos a la vez que se cierra, esa restauración aterriza en mitad de la pantalla
  // nueva y pisa cualquier foco que fijemos — el foco acababa "en un sitio raro". Navegando
  // tras el onDismiss, la restauración cae sobre el menú (inofensiva, aún visible) y el foco
  // de la pantalla nueva se fija después, el último.
  function startPasalo(mode: GameMode) {
    pendingPasaloMode.current = mode;
    setPasaloModalVisible(false);
    if (Platform.OS !== 'ios') {
      // onDismiss es solo de iOS; en web (nuestras pruebas locales) se navega directamente.
      navigatePendingPasalo();
    }
  }

  function navigatePendingPasalo() {
    const mode = pendingPasaloMode.current;
    if (mode === null) return;
    pendingPasaloMode.current = null;
    router.push({
      pathname: '/pasalo-turno',
      params: { mode, seed: String(createRandomSeed()), player: '1' },
    });
  }

  useEffect(() => {
    let cancelled = false;
    loadAllHighScores().then((scores) => {
      if (!cancelled) setHighScores(scores);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function highScoreText(mode: GameMode): string {
    if (highScores === null) return '';
    const score = highScores[mode];
    return score === 0 ? 'Sin puntuación todavía' : `Mejor: ${score} ${score === 1 ? 'ronda' : 'rondas'}`;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.hero}>
            <ThemedText type="title" style={styles.title}>
              Memorios
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
              Escucha la secuencia y repítela con un gesto en la dirección de cada color.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.menu}>
            {GAME_MODES.map((mode, index) => (
              <ModeButton
                key={mode}
                mode={mode}
                primary={index === 0}
                highScoreText={highScoreText(mode)}
                onPress={() => router.push({ pathname: '/game', params: { mode } })}
              />
            ))}

            <MenuButton
              label="Modo pásalo"
              description="Dos jugadores, la misma secuencia, pasando el teléfono. Elige la dificultad al empezar."
              onPress={() => setPasaloModalVisible(true)}
            />

            <MenuButton
              label="Aprender el mapeo"
              description="Practica sin prisa qué dirección corresponde a cada color, y el aviso de ronda invertida, antes de jugar"
              onPress={() => router.push('/learn-mapping')}
            />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      {/* Modal nativo de verdad (no una View superpuesta con accessibilityViewIsModal): esa
          técnica no atrapa bien el foco de VoiceOver fuera de su propia jerarquía (ver guía,
          §7.5). Modal sí es una presentación nativa real, VoiceOver la trata como corresponde
          sin nada especial de nuestra parte. */}
      <Modal
        visible={pasaloModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasaloModalVisible(false)}
        onDismiss={navigatePendingPasalo}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Elige la dificultad para pásalo
            </ThemedText>

            <ThemedView style={styles.menu}>
              {GAME_MODES.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => startPasalo(mode)}
                  accessibilityRole="button"
                  accessibilityLabel={`${MODE_LABELS[mode]}. ${MODE_DESCRIPTIONS[mode]}`}
                  accessibilityHint="Toca para empezar el turno del Jugador 1 en esta dificultad"
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                  <ThemedText type="subtitle" style={styles.buttonText}>
                    {MODE_LABELS[mode]}
                  </ThemedText>
                  <ThemedText style={styles.buttonSubtext}>{MODE_DESCRIPTIONS[mode]}</ThemedText>
                </Pressable>
              ))}

              <Pressable
                onPress={() => setPasaloModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <ThemedText type="subtitle" style={styles.buttonText}>
                  Cancelar
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function ModeButton({
  mode,
  primary,
  highScoreText,
  onPress,
}: {
  mode: GameMode;
  primary: boolean;
  highScoreText: string;
  onPress: () => void;
}) {
  const label = MODE_LABELS[mode];
  const description = MODE_DESCRIPTIONS[mode];

  // La descripción y la puntuación van en accessibilityLabel, no en accessibilityHint: el
  // hint es de prioridad baja (mucha gente lo lleva desactivado, o VoiceOver no siempre lo
  // dice), así que cualquier información esencial ahí puede no llegar a oírse nunca. El label
  // sí se anuncia siempre — aquí es donde tiene que ir todo lo que hace falta saber.
  const accessibilityLabel = [label, description, highScoreText].filter(Boolean).join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Toca para empezar una partida en este modo"
      style={({ pressed }) => [styles.button, primary && styles.buttonPrimary, pressed && styles.buttonPressed]}
    >
      <ThemedText type="subtitle" style={primary ? styles.buttonTextPrimary : styles.buttonText}>
        {label}
      </ThemedText>
      <ThemedText style={primary ? styles.buttonSubtextPrimary : styles.buttonSubtext}>{description}</ThemedText>
      {highScoreText ? (
        <ThemedText style={[primary ? styles.buttonSubtextPrimary : styles.buttonSubtext, styles.buttonScore]}>
          {highScoreText}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function MenuButton({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <ThemedText type="subtitle" style={styles.buttonText}>
        {label}
      </ThemedText>
      <ThemedText style={styles.buttonSubtext}>{description}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  modalTitle: {
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    justifyContent: 'space-between',
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
  },
  menu: {
    gap: Spacing.three,
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#E0E1E6',
    alignItems: 'center',
    gap: Spacing.half,
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
  buttonSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonSubtextPrimary: {
    fontSize: 14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  buttonScore: {
    fontWeight: '700',
  },
});
