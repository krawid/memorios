import { useEffect, useRef, useState } from 'react';
import { AccessibilityRole, PanResponder, StyleSheet, View } from 'react-native';

import { classifyFlick } from '@/game/flick-detector';
import { Direction } from '@/game/types';

interface FlickSurfaceProps {
  onFlick: (direction: Direction) => void;
  disabled?: boolean;
  /** Se dispara al primer contacto del dedo (antes de soltar), no al completar un flick. */
  onTouchStart?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// --- Por qué esta pantalla no usa react-native-gesture-handler ---
//
// Con VoiceOver activo, los gestos tienen que llegar en crudo a la app en vez de que
// VoiceOver los use para mover el foco. Eso se pide con el trait nativo de iOS
// UIAccessibilityTraitAllowsDirectInteraction. Dos hallazgos, ambos comprobados:
//
// 1. React Native no expone un prop para ese trait, pero `accessibilityRole` reutiliza
//    internamente la misma tabla de conversión de traits (verificado en el código nativo
//    instalado: AccessibilityProps.cpp -> accessibilityPropsConversions.h -> RCTConversions.h,
//    donde "allowsDirectInteraction" acaba en UIAccessibilityTraitAllowsDirectInteraction).
//    No es un rol ARIA real, de ahí el cast; es un hack, pero apoyado en el código fuente.
//
// 2. Con el trait puesto, VoiceOver SEGUÍA interceptando los gestos al usar
//    `Gesture.Pan()` de react-native-gesture-handler. La causa: bajo interacción directa,
//    VoiceOver entrega los toques en crudo a la vista, pero NO dispara los
//    UIGestureRecognizer — y RNGH está construido enteramente sobre ellos. El sistema de
//    respondedores propio de React Native (PanResponder) no depende de esos reconocedores
//    por vista, así que es la vía que sí puede recibir el gesto.
//
// Si algún día alguien "moderniza" esto de vuelta a RNGH, el juego dejará de ser jugable
// con VoiceOver, que es justo lo que la app existe para permitir.
const ALLOWS_DIRECT_INTERACTION_ROLE = 'allowsDirectInteraction' as AccessibilityRole;

export function FlickSurface({
  onFlick,
  disabled = false,
  onTouchStart,
  accessibilityLabel = 'Superficie de juego',
  accessibilityHint = 'Desliza el dedo en la dirección del color que quieras repetir: arriba, abajo, izquierda o derecha.',
}: FlickSurfaceProps) {
  // El PanResponder se crea UNA SOLA VEZ, nunca se recrea. Recrearlo en cada render (como
  // hacíamos antes) es peligroso: PanResponder.create() guarda el punto de inicio del gesto
  // (x0/y0) en una variable interna a esa llamada concreta, que solo se rellena en
  // onResponderGrant (el instante en que empieza el toque). Si llega un re-render — y con la
  // secuencia acelerada hay muchos seguidos, por los cambios de estado de cada tono — mientras
  // el dedo sigue en pantalla, React actualiza los props de la vista con un PanResponder
  // nuevo; si el toque en curso acaba resolviéndose contra ese nuevo objeto en vez del que
  // vivió el onResponderGrant original, su x0/y0 se quedan a 0 y el dx/dy calculado al soltar
  // es basura — puede leerse como una dirección cualquiera, no la que se hizo de verdad.
  // Verificado en el código fuente de React Native (PanResponder.js), no es una suposición.
  //
  // Para no recrearlo pero tampoco cerrar sobre valores obsoletos de onFlick/disabled, los
  // manejadores leen de una ref que se actualiza después de cada render (nunca durante el
  // render, para no chocar con la regla de hooks que prohíbe tocar refs en el cuerpo).
  const latest = useRef({ onFlick, disabled, onTouchStart });
  useEffect(() => {
    latest.current = { onFlick, disabled, onTouchStart };
  });

  // El propio PanResponder.create() también se construye dentro de un efecto (con array de
  // dependencias vacío, así que corre una sola vez) en vez de durante el render: la regla de
  // hooks de este proyecto no permite pasar nada que lea una ref a una función durante el
  // render, ni siquiera en una inicialización perezosa de useState. Dentro de un efecto sí
  // está permitido. El primer render (antes de que el efecto corra) no tiene panHandlers
  // todavía, pero eso no importa: no hay manera física de tocar la pantalla antes de que se
  // pinte el primer frame.
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: () => !latest.current.disabled,
        onPanResponderGrant: () => {
          latest.current.onTouchStart?.();
        },
        // Una vez empezado el flick, no cedemos el gesto a ningún otro respondedor: si no,
        // un gesto del navegador (o cualquier vista padre) puede quedárselo a mitad y el
        // flick nunca llega a `onPanResponderRelease`, que es donde se decide la dirección.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderRelease: (_event, gestureState) => {
          if (latest.current.disabled) return;

          const direction = classifyFlick({
            dx: gestureState.dx,
            dy: gestureState.dy,
            // PanResponder da la velocidad en puntos/milisegundo; classifyFlick trabaja en
            // puntos/segundo (la unidad que usan los umbrales), de ahí el x1000.
            vx: gestureState.vx * 1000,
            vy: gestureState.vy * 1000,
          });

          if (direction) {
            latest.current.onFlick(direction);
          }
        },
      }),
    );
  }, []);

  return (
    <View
      {...panResponder?.panHandlers}
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityRole={ALLOWS_DIRECT_INTERACTION_ROLE}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    />
  );
}
