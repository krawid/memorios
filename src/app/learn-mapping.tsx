import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  DIRECTION_COLOR_NAMES,
  DIRECTION_GLYPHS,
  DIRECTION_HEX_COLORS,
  DIRECTION_SPOKEN_NAME,
  DIRECTION_TEXT_ON_COLOR,
  DIRECTIONS_BY_PITCH,
} from '@/constants/direction-presentation';
import { Spacing } from '@/constants/theme';
import { Direction } from '@/game/types';
import { triggerDirectionHaptic, triggerReverseHaptic } from '@/lib/haptics';
import { playTone } from '@/lib/sounds';

export default function LearnMappingScreen() {
  function handlePress(direction: Direction) {
    playTone(direction);
    triggerDirectionHaptic(direction);
  }

  function handleReversePress() {
    playTone('reverse');
    triggerReverseHaptic();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            Cuanto más arriba está la dirección, más agudo suena: abajo es el sonido más grave y
            arriba el más agudo, con izquierda y derecha en medio, como en un piano. Están
            ordenadas de grave a aguda; tócalas las veces que necesites antes de jugar.
          </ThemedText>

          <ThemedView style={styles.list}>
            {DIRECTIONS_BY_PITCH.map((direction) => (
              <Pressable
                key={direction}
                onPress={() => handlePress(direction)}
                accessibilityRole="button"
                accessibilityLabel={`${DIRECTION_SPOKEN_NAME[direction]}: ${DIRECTION_COLOR_NAMES[direction]}`}
                accessibilityHint="Toca para escuchar el sonido y sentir la vibración de esta dirección"
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: DIRECTION_HEX_COLORS[direction] },
                  pressed && styles.rowPressed,
                ]}
              >
                {/* maxFontSizeMultiplier: columna de ancho fijo (56px); sin tope, "Texto más
                    grande" al máximo desbordaría la columna (verificado con números). El
                    nombre de la dirección y el color, al lado, sí escalan libres — tienen
                    sitio para crecer sin romper el diseño. */}
                <ThemedText
                  style={[styles.glyph, { color: DIRECTION_TEXT_ON_COLOR[direction] }]}
                  maxFontSizeMultiplier={1.3}
                >
                  {DIRECTION_GLYPHS[direction]}
                </ThemedText>
                <ThemedView style={styles.rowText}>
                  <ThemedText
                    type="subtitle"
                    style={[styles.rowLabel, { color: DIRECTION_TEXT_ON_COLOR[direction] }]}
                  >
                    {capitalize(DIRECTION_SPOKEN_NAME[direction])}
                  </ThemedText>
                  <ThemedText style={[styles.rowColor, { color: DIRECTION_TEXT_ON_COLOR[direction] }]}>
                    {capitalize(DIRECTION_COLOR_NAMES[direction])}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            A partir de la ronda 5, a veces suena este aviso antes de la secuencia: significa
            que hay que repetirla al revés.
          </ThemedText>

          <Pressable
            onPress={handleReversePress}
            accessibilityRole="button"
            accessibilityLabel="Aviso de ronda invertida"
            accessibilityHint="Toca para escuchar el sonido y sentir la vibración de este aviso"
            style={({ pressed }) => [styles.row, styles.reverseRow, pressed && styles.rowPressed]}
          >
            <ThemedText style={[styles.glyph, styles.reverseGlyph]} maxFontSizeMultiplier={1.3}>
              ⇄
            </ThemedText>
            <ThemedView style={styles.rowText}>
              <ThemedText type="subtitle" style={styles.reverseLabel}>
                Ronda invertida
              </ThemedText>
              <ThemedText style={styles.reverseLabel}>Repite la secuencia al revés</ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  intro: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowPressed: {
    opacity: 0.8,
  },
  reverseRow: {
    backgroundColor: '#3A3D44',
  },
  reverseGlyph: {
    color: '#FFFFFF',
  },
  reverseLabel: {
    color: '#FFFFFF',
  },
  glyph: {
    fontSize: 40,
    fontWeight: '700',
    width: 56,
    textAlign: 'center',
  },
  rowText: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  rowLabel: {},
  rowColor: {},
});
