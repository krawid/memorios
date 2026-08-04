import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Text } from 'react-native';

// Solo hace falta en pantallas SIN cabecera nativa (headerShown: false, sin título): con
// cabecera, VoiceOver ya tiene un sitio fiable donde posarse al entrar (lo aprovechamos en
// "Partida"/"Fin de la partida"). Sin ella, no hay ninguna pista y el foco puede acabar en
// cualquier sitio, o quedarse en el elemento de la pantalla anterior.
//
// El retardo deja que termine la animación de transición de la pantalla antes de mover el
// foco — pedirlo a mitad de la animación no es fiable.
const FOCUS_DELAY_MS = 400;

/**
 * Devuelve una ref para poner en el `ThemedText` (u otro `Text`) que debe recibir el foco de
 * VoiceOver al entrar en la pantalla. `key` es lo que decide CUÁNDO volver a fijarlo — pásale
 * algo que cambie cuando la pantalla deba "reanunciarse" aunque sea la misma ruta (p. ej. el
 * texto del título, que cambia entre el turno del Jugador 1 y el del Jugador 2).
 *
 * Usa `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')`, NO `setAccessibilityFocus`.
 * `setAccessibilityFocus` está marcada `@deprecated` en el propio código fuente de React
 * Native — por dentro busca la vista en `viewRegistry_DEPRECATED`, el registro de la
 * arquitectura antigua, que bajo Fabric (la que usa este proyecto) no tiene la vista y no
 * hace nada, sin avisar de ningún error. Probado en dispositivo: con `setAccessibilityFocus`
 * el foco no se movía; con `sendAccessibilityEvent` sí. `sendAccessibilityEvent` además no
 * necesita `findNodeHandle` (que ni siquiera existe en web) — toma la instancia del
 * componente directamente.
 */
export function useAccessibilityFocus(key: unknown) {
  const ref = useRef<Text>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    const timeout = setTimeout(() => {
      if (ref.current) {
        AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
      }
    }, FOCUS_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [key]);

  return ref;
}
