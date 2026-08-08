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
/** Cuántas marcas se guardan por jugador y modo, para deshacer empates. */
export const CUANTAS_MARCAS = 3;
const MIN_JUGADOR_ID = 8;
const MAX_JUGADOR_ID = 64;

/**
 * Las tres mejores marcas de un jugador en un modo, de mayor a menor. Se rellena con ceros
 * cuando no ha jugado tantas veces: "no tengo tercera marca" y "mi tercera marca es 0" ordenan
 * igual, y a efectos de desempate significan lo mismo.
 */
export type Marcas = readonly [number, number, number];

/**
 * Publicar marcas ya NO lleva apodo: el apodo se reserva aparte (ver validarReclamoApodo). Si
 * fuera en cada envío, una partida podría fallar por un choque de apodos justo al terminar, que
 * es el peor momento posible para enterarse.
 */
export interface PuntuacionEntrante {
  jugadorId: string;
  modo: Modo;
  marcas: Marcas;
}

export interface ReclamoApodo {
  jugadorId: string;
  apodo: string;
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
 * Forma con la que se comparan dos apodos para decidir si son "el mismo". Los apodos son
 * únicos sin distinguir mayúsculas: "Krawid" y "krawid" son la misma persona.
 *
 * ⚠️ Se normaliza en JavaScript y NO con `COLLATE NOCASE` de SQLite, que es lo que parecería
 * natural. Motivo comprobado: el NOCASE de SQLite **solo pliega ASCII**, así que da por
 * distintos "MOISÉS" y "Moisés", o "BEGOÑA" y "Begoña". En español eso deja pasar la mitad de
 * los nombres. `toLowerCase` de JavaScript sí entiende tildes y eñes.
 *
 * Las tildes NO se quitan a propósito: "Begoña" y "Begona" son nombres distintos, y unificarlos
 * sería decidir por la gente cómo se llama.
 */
export function normalizarParaComparar(apodo: string): string {
  return apodo.toLowerCase();
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

/**
 * Ordena de mayor a menor y rellena con ceros hasta tres. Se ordena aquí en vez de fiarse del
 * orden que mande la app: es una entrada de red, y así da igual que llegue desordenada.
 * Devuelve null si algún valor no es una puntuación válida.
 */
export function ordenarMarcas(valor: unknown): Marcas | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > CUANTAS_MARCAS) return null;

  for (const marca of valor) {
    if (typeof marca !== 'number' || !Number.isInteger(marca) || marca < 0 || marca > MAX_RONDAS) {
      return null;
    }
  }

  const ordenadas = [...(valor as number[])].sort((a, b) => b - a);
  while (ordenadas.length < CUANTAS_MARCAS) ordenadas.push(0);

  return [ordenadas[0]!, ordenadas[1]!, ordenadas[2]!];
}

/**
 * Compara dos conjuntos de marcas por orden: primero la mejor, y solo si empatan la segunda, y
 * luego la tercera. Positivo si `a` es mejor que `b`, negativo si es peor, 0 si son idénticos
 * — que es cuando entra a decidir la fecha (ver bd.ts).
 */
export function compararMarcas(a: Marcas, b: Marcas): number {
  for (let i = 0; i < CUANTAS_MARCAS; i++) {
    const diferencia = a[i]! - b[i]!;
    if (diferencia !== 0) return diferencia;
  }
  return 0;
}

export function validarPuntuacion(cuerpo: unknown): Resultado<PuntuacionEntrante> {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { ok: false, error: 'Se esperaba un objeto JSON' };
  }

  const { jugadorId, modo, marcas } = cuerpo as Record<string, unknown>;

  if (!esJugadorId(jugadorId)) return { ok: false, error: 'jugadorId no válido' };

  if (!esModo(modo)) return { ok: false, error: 'modo no válido' };

  const marcasOrdenadas = ordenarMarcas(marcas);
  if (marcasOrdenadas === null) {
    return {
      ok: false,
      error: `marcas debe ser una lista de 1 a ${CUANTAS_MARCAS} enteros entre 0 y ${MAX_RONDAS}`,
    };
  }

  return { ok: true, valor: { jugadorId, modo, marcas: marcasOrdenadas } };
}

export function validarReclamoApodo(cuerpo: unknown): Resultado<ReclamoApodo> {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { ok: false, error: 'Se esperaba un objeto JSON' };
  }

  const { jugadorId, apodo } = cuerpo as Record<string, unknown>;

  if (!esJugadorId(jugadorId)) return { ok: false, error: 'jugadorId no válido' };

  const apodoLimpio = normalizarApodo(apodo);
  if (apodoLimpio === null) {
    return { ok: false, error: `El apodo debe tener entre 1 y ${MAX_APODO} caracteres` };
  }

  return { ok: true, valor: { jugadorId, apodo: apodoLimpio } };
}

export interface FilaClasificacion {
  jugadorId: string;
  apodo: string;
  /** La mejor marca: es la que se enseña. Las otras dos solo existen para ordenar. */
  rondas: number;
  marcas: Marcas;
}

export interface PuestoClasificacion extends FilaClasificacion {
  puesto: number;
}

/**
 * Puestos estrictos, sin empates: dos jugadores con las mismas tres marcas se ordenan por la
 * fecha en que lograron su mejor marca (ver el ORDER BY de bd.ts), y dos fechas no coinciden.
 * Por eso el puesto es la posición en la lista ya ordenada, sin más.
 */
export function asignarPuestos(filas: readonly FilaClasificacion[]): PuestoClasificacion[] {
  return filas.map((fila, indice) => ({ ...fila, puesto: indice + 1 }));
}

/**
 * Lo que sale por la red. **No lleva `jugadorId`, y es deliberado.**
 *
 * Al principio sí lo llevaba, y era un agujero comprobado: el identificador es la única cosa
 * que autentica a un jugador, así que publicarlo en una clasificación abierta permitía a
 * cualquiera coger el de otro y renombrarlo a lo que quisiera (la puntuación no, porque solo
 * puede subir, pero el apodo sí). Quién es cada quien se resuelve con `eresTu`, que lo calcula
 * el servidor comparando contra el `?jugadorId=` de quien pregunta: la app sabe cuál es su fila
 * sin que nadie más pueda saber el identificador de nadie.
 */
export interface PuestoPublico {
  puesto: number;
  apodo: string;
  rondas: number;
  marcas: Marcas;
  eresTu: boolean;
}

export function aPuestoPublico(
  puesto: PuestoClasificacion,
  quienPregunta: string | null,
): PuestoPublico {
  return {
    puesto: puesto.puesto,
    apodo: puesto.apodo,
    rondas: puesto.rondas,
    marcas: puesto.marcas,
    eresTu: quienPregunta !== null && puesto.jugadorId === quienPregunta,
  };
}
