import * as Haptics from 'expo-haptics';

import { Direction } from '@/game/types';

// Un patrón háptico distinto por dirección (además del sonido y el color),
// para que cada pad se reconozca por tacto incluso sin sonido.
const DIRECTION_IMPACT_STYLE: Record<Direction, Haptics.ImpactFeedbackStyle> = {
  up: Haptics.ImpactFeedbackStyle.Light,
  right: Haptics.ImpactFeedbackStyle.Rigid,
  down: Haptics.ImpactFeedbackStyle.Heavy,
  left: Haptics.ImpactFeedbackStyle.Soft,
};

export function triggerDirectionHaptic(direction: Direction) {
  void Haptics.impactAsync(DIRECTION_IMPACT_STYLE[direction]);
}

export function triggerFailHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

// Doble pulso, distinto de cualquier otro háptico del juego (las direcciones son un único
// impacto, el fallo es el patrón de notificación de error) — redundante con el barrido de
// sonido descendente para avisar de una ronda invertida.
const REVERSE_HAPTIC_GAP_MS = 120;

export function triggerReverseHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, REVERSE_HAPTIC_GAP_MS);
}
