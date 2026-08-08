import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { cargarMarcas } from '@/game/high-score-store';
import { mejorMarca } from '@/game/marcas';
import { GAME_MODES, GameMode } from '@/game/modes';
import {
  leerClasificacion,
  publicarMarcas,
  type Clasificacion,
  type PuestoClasificacion,
  type ResultadoClasificacion,
} from '@/lib/clasificacion-api';
import { obtenerApodo, obtenerJugadorId } from '@/lib/identidad';

function esModo(valor: unknown): valor is GameMode {
  return typeof valor === 'string' && (GAME_MODES as readonly string[]).includes(valor);
}

function rondasTexto(rondas: number): string {
  return `${rondas} ${rondas === 1 ? 'ronda' : 'rondas'}`;
}

/**
 * Cómo lee VoiceOver cada puesto. Es UNA sola frase para UN solo elemento accesible: si el
 * puesto, el apodo y las rondas fueran tres elementos sueltos, recorrer diez posiciones
 * costaría treinta gestos en vez de diez.
 */
function etiquetaDePuesto(puesto: PuestoClasificacion): string {
  const quien = puesto.eresTu ? `${puesto.apodo}, tú` : puesto.apodo;
  return `${puesto.puesto}.º, ${quien}, ${rondasTexto(puesto.rondas)}`;
}

export default function ClasificacionModoScreen() {
  const { modo: modoParam } = useLocalSearchParams<{ modo?: string }>();
  const modo: GameMode = esModo(modoParam) ? modoParam : 'tranqui';

  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [clasificacion, setClasificacion] = useState<Clasificacion | null>(null);

  // Obtener los datos y aplicarlos al estado van SEPARADOS a propósito. Así el efecto solo
  // encadena un `then` (que es lo que se espera de un efecto: suscribirse a algo externo y
  // actualizar el estado en la respuesta) y, sobre todo, puede descartar el resultado si la
  // pantalla ya no está: sin eso, salir de aquí mientras carga actualiza un componente muerto.
  const obtenerDatos = useCallback(async () => {
    const jugadorId = await obtenerJugadorId();

    // Antes de leer, se reenvían las mejores marcas locales. Es la red de seguridad de todo el
    // sistema: si alguna publicación se perdió (sin cobertura, servidor caído), aquí se
    // recupera sola. Publicar es idempotente y el servidor conserva siempre lo mejor, así que
    // reenviar de más nunca estropea nada.
    const apodo = await obtenerApodo();
    if (apodo !== null) {
      const marcas = await cargarMarcas(modo);
      if (mejorMarca(marcas) > 0) await publicarMarcas(jugadorId, modo, marcas);
    }

    return leerClasificacion(modo, jugadorId);
  }, [modo]);

  const aplicar = useCallback((resultado: ResultadoClasificacion) => {
    if (resultado.ok) {
      setClasificacion(resultado.clasificacion);
      setEstado('listo');
    } else {
      setError(resultado.error);
      setEstado('error');
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerDatos().then((resultado) => {
      if (!cancelado) aplicar(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [obtenerDatos, aplicar]);

  function reintentar() {
    setEstado('cargando');
    obtenerDatos().then(aplicar);
  }

  // Los cambios de estado se anuncian: sin esto, quien usa VoiceOver no tiene forma de saber
  // que la lista ya cargó o que falló — el cambio es puramente visual.
  useEffect(() => {
    if (estado === 'cargando') return;

    const mensaje =
      estado === 'error'
        ? error
        : (clasificacion?.puestos.length ?? 0) === 0
          ? 'Todavía no hay ninguna marca en este modo.'
          : `Clasificación cargada. ${clasificacion?.puestos.length} en la lista.`;

    AccessibilityInfo.announceForAccessibility(mensaje);
  }, [estado, error, clasificacion]);

  const puestos = clasificacion?.puestos ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            A igual mejor marca, va por delante quien tenga mejor segunda marca. Por eso jugar
            más de una buena partida cuenta.
          </ThemedText>

          {estado === 'cargando' ? (
            <ThemedText style={styles.aviso} accessibilityLabel="Cargando la clasificación">
              Cargando…
            </ThemedText>
          ) : null}

          {estado === 'error' ? (
            <ThemedView style={styles.avisoBloque}>
              <ThemedText style={styles.aviso}>{error}</ThemedText>
              <Pressable
                onPress={reintentar}
                accessibilityRole="button"
                accessibilityLabel="Reintentar cargar la clasificación"
                style={({ pressed }) => [styles.boton, pressed && styles.botonPulsado]}
              >
                <ThemedText type="subtitle" style={styles.botonTexto}>
                  Reintentar
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          {estado === 'listo' && puestos.length === 0 ? (
            <ThemedText style={styles.aviso}>
              Todavía no hay ninguna marca en {MODE_LABELS[modo].toLowerCase()}. Juega una partida
              y serás el primero.
            </ThemedText>
          ) : null}

          {estado === 'listo' && puestos.length > 0 ? (
            <ThemedView style={styles.lista}>
              {puestos.map((puesto) => (
                <ThemedView
                  key={`${puesto.puesto}-${puesto.apodo}`}
                  // accessible: agrupa las tres cosas en un solo elemento (ver etiquetaDePuesto).
                  accessible
                  accessibilityLabel={etiquetaDePuesto(puesto)}
                  style={[styles.fila, puesto.eresTu && styles.filaPropia]}
                >
                  <ThemedText type="subtitle" style={styles.puesto}>
                    {puesto.puesto}.º
                  </ThemedText>
                  <ThemedText style={styles.apodo} numberOfLines={1}>
                    {puesto.apodo}
                    {puesto.eresTu ? ' (tú)' : ''}
                  </ThemedText>
                  <ThemedText type="subtitle">{puesto.rondas}</ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : null}

          {estado === 'listo' && clasificacion?.propio ? (
            <ThemedView style={styles.propioBloque}>
              <ThemedText themeColor="textSecondary" style={styles.aviso}>
                No sales entre los primeros:
              </ThemedText>
              <ThemedView
                accessible
                accessibilityLabel={`Tu puesto: ${etiquetaDePuesto(clasificacion.propio)}`}
                style={[styles.fila, styles.filaPropia]}
              >
                <ThemedText type="subtitle" style={styles.puesto}>
                  {clasificacion.propio.puesto}.º
                </ThemedText>
                <ThemedText style={styles.apodo} numberOfLines={1}>
                  {clasificacion.propio.apodo} (tú)
                </ThemedText>
                <ThemedText type="subtitle">{clasificacion.propio.rondas}</ThemedText>
              </ThemedView>
            </ThemedView>
          ) : null}
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
  aviso: { textAlign: 'center' },
  avisoBloque: { gap: Spacing.three },
  lista: { gap: Spacing.two },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#E0E1E6',
    minHeight: 48,
  },
  // Contraste comprobado: #C9D8F0 con el texto oscuro del tema pasa de sobra el 4,5:1 de WCAG,
  // y además la fila propia se distingue por texto ("(tú)"), no solo por color — quien no
  // distingue colores tiene la misma información.
  filaPropia: { backgroundColor: '#C9D8F0' },
  puesto: { minWidth: 48 },
  apodo: { flex: 1 },
  propioBloque: { gap: Spacing.two },
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
  botonTexto: { color: '#FFFFFF' },
});
