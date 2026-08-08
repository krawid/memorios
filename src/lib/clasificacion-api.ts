import { GameMode } from '@/game/modes';
import type { Marcas } from '@/game/marcas';

/**
 * Cliente de la API de clasificaciones.
 *
 * Principio que manda sobre todo lo demás: **la clasificación es un añadido, nunca un
 * requisito**. Si el servidor está caído, sin cobertura o tarda, el juego se juega igual de
 * bien. Por eso publicar nunca lanza una excepción hacia arriba ni bloquea nada, y leer
 * devuelve un error que la pantalla sabe enseñar en vez de reventar.
 */

const SERVIDOR = 'https://memorios-production.up.railway.app';

// Sin esto, una petición puede quedarse colgada indefinidamente (móvil con cobertura pésima) y
// dejar la pantalla girando para siempre. fetch no trae tiempo de espera propio.
const ESPERA_MS = 8000;

export interface PuestoClasificacion {
  puesto: number;
  apodo: string;
  rondas: number;
  marcas: Marcas;
  /** true en la fila de quien está mirando: la pantalla la destaca y la anuncia distinto. */
  eresTu: boolean;
}

export interface Clasificacion {
  puestos: PuestoClasificacion[];
  /** Tu puesto, solo si NO sales entre los primeros. null si ya apareces arriba o no juegas. */
  propio: PuestoClasificacion | null;
}

async function pedir(ruta: string, opciones: RequestInit = {}): Promise<Response> {
  const abortador = new AbortController();
  const temporizador = setTimeout(() => abortador.abort(), ESPERA_MS);

  try {
    return await fetch(`${SERVIDOR}${ruta}`, { ...opciones, signal: abortador.signal });
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Publica las marcas. Nunca lanza: si falla, se pierde este envío y ya está — la app reenvía
 * sus mejores marcas cada vez que se abre la clasificación, y el servidor se queda siempre con
 * las mejores, así que un fallo puntual se corrige solo más adelante.
 *
 * Devuelve true solo si el servidor confirmó.
 */
export async function publicarMarcas(
  jugadorId: string,
  apodo: string,
  modo: GameMode,
  marcas: Marcas,
): Promise<boolean> {
  try {
    const respuesta = await pedir('/puntuaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadorId, apodo, modo, marcas }),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

export type ResultadoClasificacion =
  | { ok: true; clasificacion: Clasificacion }
  | { ok: false; error: string };

export async function leerClasificacion(
  modo: GameMode,
  jugadorId: string | null,
): Promise<ResultadoClasificacion> {
  const parametro = jugadorId === null ? '' : `?jugadorId=${encodeURIComponent(jugadorId)}`;

  try {
    const respuesta = await pedir(`/clasificacion/${modo}${parametro}`);
    if (!respuesta.ok) {
      return { ok: false, error: 'No se pudo cargar la clasificación. Inténtalo de nuevo.' };
    }

    const datos = (await respuesta.json()) as Clasificacion;
    return { ok: true, clasificacion: { puestos: datos.puestos ?? [], propio: datos.propio ?? null } };
  } catch {
    // Incluye el corte por tiempo de espera. Mismo mensaje: a quien juega le da igual la causa.
    return { ok: false, error: 'No hay conexión con el servidor. La clasificación no está disponible.' };
  }
}
