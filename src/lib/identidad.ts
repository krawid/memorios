import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizarApodo } from './apodo';

/**
 * El único sitio de la app que responde "¿quién soy?".
 *
 * **Esto es una costura deliberada.** Hoy la identidad es un identificador al azar generado en
 * el móvil, sin cuentas ni contraseñas. El día que haya *Sign in with Apple*, cambia solo este
 * archivo: `obtenerJugadorId` devolvería el identificador de la cuenta y el resto de la app —
 * pantallas, envío de puntuaciones, servidor — no se entera de nada. El servidor también trata
 * ese identificador como opaco justo por lo mismo.
 *
 * Contrapartida honesta de no tener login: si cambias de móvil, empiezas de cero.
 */

const CLAVE_JUGADOR = 'memorios.jugadorId';
const CLAVE_APODO = 'memorios.apodo';

/**
 * Identificador opaco. El servidor exige entre 8 y 64 caracteres de [A-Za-z0-9._-], así que se
 * genera dentro de ese alfabeto a propósito.
 *
 * No se usa `crypto.randomUUID` porque no está garantizado en Hermes; `Math.random` sobra aquí:
 * esto no es un secreto ni protege nada, solo distingue un móvil de otro.
 */
function generarJugadorId(): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 24; i++) {
    id += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return id;
}

export async function obtenerJugadorId(): Promise<string> {
  const guardado = await AsyncStorage.getItem(CLAVE_JUGADOR);
  if (guardado !== null && guardado.length >= 8) return guardado;

  const nuevo = generarJugadorId();
  await AsyncStorage.setItem(CLAVE_JUGADOR, nuevo);
  return nuevo;
}

/** null si todavía no ha puesto ninguno: sin apodo no se publica nada. */
export async function obtenerApodo(): Promise<string | null> {
  const guardado = await AsyncStorage.getItem(CLAVE_APODO);
  return guardado === null ? null : normalizarApodo(guardado);
}

/** Devuelve el apodo ya normalizado, o null si no era utilizable (y entonces no guarda nada). */
export async function guardarApodo(apodo: string): Promise<string | null> {
  const limpio = normalizarApodo(apodo);
  if (limpio === null) return null;

  await AsyncStorage.setItem(CLAVE_APODO, limpio);
  return limpio;
}
