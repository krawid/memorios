/**
 * Validación de lo que llega por la red. Todo lo de este archivo es puro: sin base de datos,
 * sin HTTP, sin reloj. Así se puede probar entero sin levantar nada (ver validacion.prueba.ts).
 *
 * Regla de fondo: el servidor NO se fía de la app. No porque la app mienta, sino porque
 * cualquiera puede mandar una petición a mano — el repositorio es público y la dirección del
 * servidor se ve en el código. Esto no convierte las puntuaciones en verificables (ver README:
 * sin semilla no hay forma), pero sí impide que un descuido o un curioso llenen la tabla de
 * basura.
 */

export const MODOS = ['tranqui', 'chunguillo', 'nidecona'] as const;
export type Modo = (typeof MODOS)[number];

/** Techo del absurdo, no un límite del juego: nadie memoriza 200 direcciones seguidas. */
export const MAX_RONDAS = 200;
export const MAX_APODO = 20;
const MIN_JUGADOR_ID = 8;
const MAX_JUGADOR_ID = 64;

export interface PuntuacionEntrante {
  jugadorId: string;
  apodo: string;
  modo: Modo;
  rondas: number;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

export function esModo(valor: unknown): valor is Modo {
  return typeof valor === 'string' && (MODOS as readonly string[]).includes(valor);
}

/**
 * Recorta, colapsa espacios internos y rechaza caracteres de control (que en un lector de
 * pantalla se leen fatal, o directamente rompen el renderizado de la lista).
 * Devuelve null si no queda un apodo utilizable.
 */
export function normalizarApodo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  // Caracteres de control por codigo, no con un regex: escritos literalmente en el fuente
  // son bytes invisibles que cualquier editor puede destrozar sin que se note.
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo < 0x20 || codigo === 0x7f) return null;
  }

  const limpio = valor.trim().replace(/\s+/g, ' ');
  if (limpio.length === 0 || limpio.length > MAX_APODO) return null;
  return limpio;
}

/**
 * El identificador de jugador es OPACO a propósito: hoy lo genera el móvil al azar, y el día
 * que haya login será el identificador de la cuenta. El servidor no debe suponer nunca qué hay
 * dentro — es lo que permite añadir login más adelante sin rehacer nada de esto.
 */
export function esJugadorId(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.length >= MIN_JUGADOR_ID &&
    valor.length <= MAX_JUGADOR_ID &&
    /^[A-Za-z0-9._-]+$/.test(valor)
  );
}

export function validarPuntuacion(cuerpo: unknown): Resultado<PuntuacionEntrante> {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { ok: false, error: 'Se esperaba un objeto JSON' };
  }

  const { jugadorId, apodo, modo, rondas } = cuerpo as Record<string, unknown>;

  if (!esJugadorId(jugadorId)) return { ok: false, error: 'jugadorId no válido' };

  const apodoLimpio = normalizarApodo(apodo);
  if (apodoLimpio === null) {
    return { ok: false, error: `El apodo debe tener entre 1 y ${MAX_APODO} caracteres` };
  }

  if (!esModo(modo)) return { ok: false, error: 'modo no válido' };

  if (typeof rondas !== 'number' || !Number.isInteger(rondas) || rondas < 0 || rondas > MAX_RONDAS) {
    return { ok: false, error: `rondas debe ser un entero entre 0 y ${MAX_RONDAS}` };
  }

  return { ok: true, valor: { jugadorId, apodo: apodoLimpio, modo, rondas } };
}

export interface FilaClasificacion {
  jugadorId: string;
  apodo: string;
  rondas: number;
}

export interface PuestoClasificacion extends FilaClasificacion {
  puesto: number;
}

/**
 * Puestos con empates compartidos (1, 2, 2, 4), que es lo que la gente espera de una
 * clasificación: dos personas con las mismas rondas están empatadas, no una por delante de la
 * otra por haber llegado antes. Espera las filas YA ordenadas de más a menos rondas.
 */
export function asignarPuestos(filas: readonly FilaClasificacion[]): PuestoClasificacion[] {
  let puestoAnterior = 0;
  let rondasAnteriores = Number.POSITIVE_INFINITY;

  return filas.map((fila, indice) => {
    const puesto = fila.rondas === rondasAnteriores ? puestoAnterior : indice + 1;
    puestoAnterior = puesto;
    rondasAnteriores = fila.rondas;
    return { ...fila, puesto };
  });
}
