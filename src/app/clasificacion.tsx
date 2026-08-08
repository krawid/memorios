import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { cargarTodasLasMarcas } from '@/game/high-score-store';
import { mejorMarca, type Marcas } from '@/game/marcas';
import { GAME_MODES, GameMode } from '@/game/modes';
import { obtenerApodo } from '@/lib/identidad';

/**
 * Primer nivel de la clasificación: elegir modo.
 *
 * Son dos niveles (elegir modo → ranking) y no una lista larga con secciones porque la guía
 * compartida lo documenta: las listas planas grandes son hostiles con VoiceOver, y el patrón
 * que funciona es el mismo que usan las apps de Apple, ir entrando por niveles.
 *
 * Ver la clasificación NO exige apodo: cualquiera puede mirar. El apodo solo hace falta para
 * aparecer en ella, y por eso se ofrece aquí sin bloquear nada.
 */
export default function ClasificacionScreen() {
  const router = useRouter();
  const [apodo, setApodo] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Record<GameMode, Marcas> | null>(null);

  // useFocusEffect y no useEffect: al volver de poner el apodo o de ver un ranking, esta
  // pantalla sigue montada y un efecto de "solo al montar" no se enteraría del cambio.
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      Promise.all([obtenerApodo(), cargarTodasLasMarcas()]).then(([nuevoApodo, nuevasMarcas]) => {
        if (cancelado) return;
        setApodo(nuevoApodo);
        setMarcas(nuevasMarcas);
      });
      return () => {
        cancelado = true;
      };
    }, []),
  );

  function textoMarca(modo: GameMode): string {
    if (marcas === null) return '';
    const mejor = mejorMarca(marcas[modo]);
    return mejor === 0 ? 'Todavía no has jugado a este modo' : `Tu mejor marca: ${mejor} ${mejor === 1 ? 'ronda' : 'rondas'}`;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            Cada modo tiene su propia clasificación: comparar rondas de tranqui con las de ni de
            coña no diría nada, son dificultades distintas.
          </ThemedText>

          <ThemedView style={styles.lista}>
            {GAME_MODES.map((modo) => (
              <Pressable
                key={modo}
                onPress={() => router.push({ pathname: '/clasificacion-modo', params: { modo } })}
                accessibilityRole="button"
                // Toda la información esencial va en el label, nunca en el hint: el hint es de
                // prioridad baja y mucha gente lo lleva desactivado (ver guía).
                accessibilityLabel={`Clasificación de ${MODE_LABELS[modo]}. ${textoMarca(modo)}`}
                style={({ pressed }) => [styles.fila, pressed && styles.filaPulsada]}
              >
                <ThemedText type="subtitle">{MODE_LABELS[modo]}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.filaDetalle}>
                  {textoMarca(modo)}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.apodoBloque}>
            <Pressable
              onPress={() => router.push('/apodo')}
              accessibilityRole="button"
              accessibilityLabel={
                apodo === null
                  ? 'Poner un apodo para aparecer en la clasificación'
                  : `Cambiar tu apodo. Ahora es ${apodo}`
              }
              style={({ pressed }) => [styles.fila, styles.filaApodo, pressed && styles.filaPulsada]}
            >
              <ThemedText type="subtitle">{apodo === null ? 'Poner un apodo' : 'Cambiar apodo'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.filaDetalle}>
                {apodo === null
                  ? 'Sin apodo no apareces en la clasificación, pero puedes mirarla igual.'
                  : `Ahora eres ${apodo}`}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  intro: { textAlign: 'center' },
  lista: { gap: Spacing.three },
  fila: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#E0E1E6',
    gap: Spacing.half,
    // 48 y no 44: el mínimo de Apple es 44 pt, pero con un poco más se falla menos al tocar.
    minHeight: 48,
    justifyContent: 'center',
  },
  filaApodo: { backgroundColor: '#D6DAE2' },
  filaPulsada: { opacity: 0.7 },
  filaDetalle: { fontSize: 14 },
  apodoBloque: { gap: Spacing.three },
});
