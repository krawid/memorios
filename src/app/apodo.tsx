import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { cargarTodasLasMarcas } from '@/game/high-score-store';
import { mejorMarca } from '@/game/marcas';
import { GAME_MODES } from '@/game/modes';
import { errorDeApodo, MAX_APODO } from '@/lib/apodo';
import { publicarMarcas } from '@/lib/clasificacion-api';
import { guardarApodo, obtenerApodo, obtenerJugadorId } from '@/lib/identidad';

export default function ApodoScreen() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerApodo().then((actual) => {
      if (actual !== null) setTexto(actual);
    });
  }, []);

  async function guardar() {
    const problema = errorDeApodo(texto);
    if (problema !== null) {
      setError(problema);
      // Un error solo pintado en pantalla no existe para quien usa VoiceOver.
      AccessibilityInfo.announceForAccessibility(problema);
      return;
    }

    setGuardando(true);
    const limpio = await guardarApodo(texto);
    if (limpio === null) {
      setGuardando(false);
      return;
    }

    // Al estrenar apodo se publican de golpe las marcas que ya tuviera guardadas: si no, quien
    // lleva semanas jugando aparecería con la clasificación vacía hasta la siguiente partida.
    const jugadorId = await obtenerJugadorId();
    const todas = await cargarTodasLasMarcas();
    await Promise.all(
      GAME_MODES.filter((modo) => mejorMarca(todas[modo]) > 0).map((modo) =>
        publicarMarcas(jugadorId, limpio, modo, todas[modo]),
      ),
    );

    AccessibilityInfo.announceForAccessibility(`Apodo guardado: ${limpio}`);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.contenido}>
          <ThemedText type="default" themeColor="textSecondary">
            Es el nombre con el que aparecerás en la clasificación. Lo ve el resto de jugadores,
            así que no pongas nada que no quieras enseñar.
          </ThemedText>

          <ThemedView style={styles.campo}>
            {/* La etiqueta va en accessibilityLabel del propio campo, no solo como texto encima:
                un texto suelto al lado no se lee como el nombre del campo al enfocarlo. */}
            <ThemedText type="subtitle">Apodo</ThemedText>
            <TextInput
              value={texto}
              onChangeText={(valor) => {
                setTexto(valor);
                if (error !== null) setError(null);
              }}
              maxLength={MAX_APODO}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={guardar}
              accessibilityLabel="Apodo"
              accessibilityHint={`Máximo ${MAX_APODO} caracteres`}
              style={styles.entrada}
            />
            <ThemedText themeColor="textSecondary" style={styles.ayuda}>
              Máximo {MAX_APODO} caracteres.
            </ThemedText>
          </ThemedView>

          {error !== null ? (
            <ThemedText style={styles.error} accessibilityLabel={`Error: ${error}`}>
              {error}
            </ThemedText>
          ) : null}
        </ThemedView>

        <Pressable
          onPress={guardar}
          disabled={guardando}
          accessibilityRole="button"
          accessibilityLabel="Guardar apodo"
          accessibilityState={{ disabled: guardando }}
          style={({ pressed }) => [styles.boton, pressed && styles.botonPulsado, guardando && styles.botonInactivo]}
        >
          <ThemedText type="subtitle" style={styles.botonTexto}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    justifyContent: 'space-between',
  },
  contenido: { gap: Spacing.four },
  campo: { gap: Spacing.two },
  entrada: {
    borderWidth: 2,
    borderColor: '#6B7280',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 20,
    minHeight: 48,
    color: '#11181C',
    backgroundColor: '#FFFFFF',
  },
  ayuda: { fontSize: 14 },
  // #B3261E sobre fondo claro pasa el 4,5:1 de WCAG. Y el error además se anuncia por voz y
  // lleva la palabra "Error" en la etiqueta: no se comunica solo con color.
  error: { color: '#B3261E' },
  boton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#3A6EA5',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  botonPulsado: { opacity: 0.7 },
  botonInactivo: { opacity: 0.5 },
  botonTexto: { color: '#FFFFFF' },
});
