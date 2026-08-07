import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

import { debeAvisarNovedades } from './update-novelties';
import { wait } from './wait';

const LAST_SEEN_UPDATE_ID_KEY = 'memorios.lastSeenUpdateId';

// `reloadAsync()` es poco fiable si se llama justo al arrancar la app, antes de que el propio
// módulo de expo-updates termine de inicializarse (confirmado: fallos conocidos en su
// repositorio). Comprobado en dispositivo real con Memorios — la actualización se descargaba
// bien, pero no se aplicaba en caliente hasta cerrar y reabrir del todo, sin ningún error
// visible. Este margen deja que arranque de verdad antes de tocar nada de Updates.
const ARRANQUE_DELAY_MS = 2000;

// El --message de `eas update` no llega al dispositivo: este es el único sitio real donde vive
// el texto de novedades. Actualizarlo en cada actualización por aire que merezca aviso, antes
// de publicarla.
const NOVEDADES_VERSION_ACTUAL =
  'Corregido: a veces, tras instalar una actualización, hacía falta cerrar y volver a abrir la app para verla aplicada del todo.';

async function comprobarNovedadesTrasArrancar() {
  const idActual = Updates.updateId;
  const idUltimoVisto = await AsyncStorage.getItem(LAST_SEEN_UPDATE_ID_KEY);

  if (idActual !== null && idActual !== idUltimoVisto) {
    await AsyncStorage.setItem(LAST_SEEN_UPDATE_ID_KEY, idActual);
  }

  if (debeAvisarNovedades(idUltimoVisto, idActual)) {
    Alert.alert('Memorios se ha actualizado', NOVEDADES_VERSION_ACTUAL);
  }
}

async function instalarActualizacion() {
  try {
    AccessibilityInfo.announceForAccessibilityWithOptions('Descargando actualización…', { priority: 'high' });
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    AccessibilityInfo.announceForAccessibilityWithOptions('No se pudo instalar la actualización.', {
      priority: 'high',
    });
    Alert.alert('No se pudo instalar', 'Inténtalo de nuevo más tarde.');
  }
}

function preguntarSiHayActualizacion() {
  Alert.alert('Nueva versión disponible', 'La app se reiniciará para instalarla. ¿Instalar ahora?', [
    { text: 'Ahora no', style: 'cancel' },
    { text: 'Instalar', onPress: instalarActualizacion },
  ]);
}

async function comprobarActualizacionDisponible() {
  // Sin esto no hay nada que comprobar (Expo Go, development sin canal) y `checkForUpdateAsync`
  // revienta en vez de decirlo.
  if (!Updates.isEnabled) return;

  try {
    const resultado = await Updates.checkForUpdateAsync();
    if (resultado.isAvailable) preguntarSiHayActualizacion();
  } catch {
    // Sin conexión o fallo puntual: no molestar ahora, se vuelve a comprobar en el siguiente
    // arranque o al volver a primer plano.
  }
}

/**
 * Comprueba actualizaciones al abrir la app y cada vez que vuelve a primer plano, y avisa de
 * las novedades de la que ya se instaló sola en el arranque anterior. Ver guía §"Avisar al
 * usuario y actualizar en caliente" — por defecto expo-updates aplica en silencio, lo peor
 * posible para quien juega de oído.
 */
export function useAppUpdates() {
  const comprobando = useRef(false);

  useEffect(() => {
    let cancelado = false;

    function comprobarConDeduplicado() {
      if (comprobando.current) return;
      comprobando.current = true;
      comprobarActualizacionDisponible().finally(() => {
        comprobando.current = false;
      });
    }

    wait(ARRANQUE_DELAY_MS).then(() => {
      if (cancelado) return;
      comprobarNovedadesTrasArrancar();
      comprobarConDeduplicado();
    });

    const subscription = AppState.addEventListener('change', (state) => {
      // Solo al volver a primer plano, nunca en el primer disparo (ya cubierto arriba con el
      // margen de arranque): AppState puede emitir un "active" inicial junto con el montaje.
      if (state === 'active') comprobarConDeduplicado();
    });
    return () => {
      cancelado = true;
      subscription.remove();
    };
  }, []);
}
