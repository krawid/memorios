import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

import { debeAvisarNovedades } from './update-novelties';

const LAST_SEEN_UPDATE_ID_KEY = 'memorios.lastSeenUpdateId';

// El --message de `eas update` no llega al dispositivo: este es el único sitio real donde vive
// el texto de novedades. Actualizarlo en cada actualización por aire que merezca aviso, antes
// de publicarla.
const NOVEDADES_VERSION_ACTUAL =
  'La app ahora avisa antes de instalar una actualización y cuenta qué ha cambiado, en vez de aplicarla en silencio.';

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
    comprobarNovedadesTrasArrancar();

    function comprobarConDeduplicado() {
      if (comprobando.current) return;
      comprobando.current = true;
      comprobarActualizacionDisponible().finally(() => {
        comprobando.current = false;
      });
    }

    comprobarConDeduplicado();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') comprobarConDeduplicado();
    });
    return () => subscription.remove();
  }, []);
}
