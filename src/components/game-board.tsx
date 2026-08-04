import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DIRECTION_GLYPHS, DIRECTION_HEX_COLORS, DIRECTION_TEXT_ON_COLOR } from '@/constants/direction-presentation';
import { Direction } from '@/game/types';

interface GameBoardProps {
  activeDirection: Direction | null;
  roundNumber: number;
  reversed?: boolean;
}

// Puramente decorativo: para usuarios de VoiceOver toda la información llega por
// audio/háptico/anuncios, no por aquí. Ocultarlo evita que VoiceOver navegue a un
// cuadrante en el que tocar no hace nada (la interacción real es el flick, ver
// FlickSurface).
export function GameBoard({ activeDirection, roundNumber, reversed = false }: GameBoardProps) {
  return (
    <View style={styles.wrapper} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Aviso puramente visual para baja visión/videntes; quien usa VoiceOver ya recibe esto
          por el barrido de sonido + doble pulso háptico al empezar la ronda. */}
      <ThemedText style={[styles.reversedBadge, !reversed && styles.reversedBadgeHidden]}>
        ⇄ Ronda invertida
      </ThemedText>

      <View style={styles.board}>
        <View style={styles.row}>
          <View style={styles.corner} />
          <Pad direction="up" active={activeDirection === 'up'} />
          <View style={styles.corner} />
        </View>
        <View style={styles.row}>
          <Pad direction="left" active={activeDirection === 'left'} />
          <View style={styles.center}>
            {/* maxFontSizeMultiplier: la caja es de tamaño fijo (96px, ver CELL) para que el
                tablero en cruz encaje siempre igual; sin tope, el ajuste más extremo de "Texto
                más grande" del sistema (Accessibility XXXL, ~3.1x) desborda la caja. Verificado
                con números: con este tope el texto sigue creciendo un 80%, y ese máximo cabe. */}
            <ThemedText type="title" style={styles.roundNumber} maxFontSizeMultiplier={1.8}>
              {roundNumber}
            </ThemedText>
          </View>
          <Pad direction="right" active={activeDirection === 'right'} />
        </View>
        <View style={styles.row}>
          <View style={styles.corner} />
          <Pad direction="down" active={activeDirection === 'down'} />
          <View style={styles.corner} />
        </View>
      </View>
    </View>
  );
}

function Pad({ direction, active }: { direction: Direction; active: boolean }) {
  return (
    <View
      style={[
        styles.pad,
        { backgroundColor: DIRECTION_HEX_COLORS[direction] },
        active && styles.padActive,
      ]}
    >
      <ThemedText
        style={[styles.glyph, { color: DIRECTION_TEXT_ON_COLOR[direction] }]}
        maxFontSizeMultiplier={1.8}
      >
        {DIRECTION_GLYPHS[direction]}
      </ThemedText>
    </View>
  );
}

const CELL = 96;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },
  reversedBadge: {
    fontSize: 16,
    fontWeight: '700',
    // Altura reservada siempre, visible o no: así no aparece/desaparece dando un salto al
    // resto del tablero cada vez que empieza o termina una ronda invertida.
    minHeight: 22,
  },
  reversedBadgeHidden: {
    opacity: 0,
  },
  board: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  corner: {
    width: CELL,
    height: CELL,
  },
  center: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundNumber: {
    fontSize: 32,
  },
  pad: {
    width: CELL,
    height: CELL,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'transparent',
  },
  padActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
  },
  glyph: {
    fontSize: 40,
    fontWeight: '700',
  },
});
