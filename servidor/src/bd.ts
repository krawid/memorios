import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  asignarPuestos,
  compararMarcas,
  normalizarParaComparar,
  type FilaClasificacion,
  type Marcas,
  type Modo,
  type PuestoClasificacion,
  type PuntuacionEntrante,
  type Resultado,
} from './validacion.ts';

/**
 * SQLite incorporado en Node (node:sqlite), sin dependencias que compilar.
 *
 * ⚠️ El fichero DEBE vivir en un volumen persistente de Railway. El sistema de archivos del
 * contenedor es efímero: sin volumen, cada despliegue borra la clasificación entera y no da
 * ningún error — simplemente un día la tabla aparece vacía. Ver README.
 */
export function abrirBaseDeDatos(ruta: string): DatabaseSync {
  mkdirSync(dirname(ruta), { recursive: true });

  const bd = new DatabaseSync(ruta);

  // WAL: lecturas concurrentes sin bloquear a quien escribe. Con siete jugadores da igual,
  // pero es gratis y evita sorpresas si alguna vez son más.
  bd.exec('PRAGMA journal_mode = WAL');
  bd.exec('PRAGMA busy_timeout = 5000');

  // El apodo vive aquí y no en cada puntuación: es una propiedad de la persona, no de cada
  // modo que juega. Y así la unicidad la garantiza la propia base de datos.
  bd.exec(`
    CREATE TABLE IF NOT EXISTS jugadores (
      jugador_id        TEXT PRIMARY KEY,
      apodo             TEXT NOT NULL,
      -- El apodo en minúsculas. La restricción UNIQUE va AQUÍ y no sobre 'apodo': es lo que
      -- impide que existan "Krawid" y "krawid" a la vez. Al estar en la base de datos, dos
      -- peticiones simultáneas no pueden colarse entre la comprobación y el guardado.
      apodo_normalizado TEXT NOT NULL UNIQUE,
      actualizado       TEXT NOT NULL
    )
  `);

  bd.exec(`
    CREATE TABLE IF NOT EXISTS puntuaciones (
      jugador_id  TEXT    NOT NULL,
      apodo       TEXT    NOT NULL DEFAULT '',
      modo        TEXT    NOT NULL,
      mejor1      INTEGER NOT NULL,
      mejor2      INTEGER NOT NULL,
      mejor3      INTEGER NOT NULL,
      -- Cuándo se logró mejor1. Es el último criterio de desempate, el que garantiza que dos
      -- jugadores nunca compartan puesto: dos marcas de tiempo no coinciden.
      logrado     TEXT    NOT NULL,
      actualizado TEXT    NOT NULL,
      PRIMARY KEY (jugador_id, modo)
    )
  `);

  bd.exec(`
    CREATE INDEX IF NOT EXISTS idx_clasificacion
    ON puntuaciones (modo, mejor1 DESC, mejor2 DESC, mejor3 DESC, logrado ASC)
  `);

  migrarApodosAJugadores(bd);

  return bd;
}

/**
 * Traslada los apodos que vivían dentro de `puntuaciones` a la tabla `jugadores`.
 *
 * Hace falta porque una versión anterior guardaba el apodo repetido en cada fila de
 * puntuación. Es idempotente: si no hay nada que mover, no hace nada.
 *
 * Si dos personas tenían apodos que ahora chocan (mismo texto en distinta caja), el UNIQUE
 * rechaza el segundo y ese jugador se queda sin apodo hasta que elija otro. Es preferible a
 * fallar el arranque del servidor.
 */
function migrarApodosAJugadores(bd: DatabaseSync): void {
  const filas = bd
    .prepare("SELECT DISTINCT jugador_id, apodo FROM puntuaciones WHERE apodo <> '' ORDER BY jugador_id")
    .all() as unknown as { jugador_id: string; apodo: string }[];

  if (filas.length === 0) return;

  const insertar = bd.prepare(
    `INSERT OR IGNORE INTO jugadores (jugador_id, apodo, apodo_normalizado, actualizado)
     VALUES (?, ?, ?, ?)`,
  );
  const ahora = new Date().toISOString();

  for (const fila of filas) {
    insertar.run(fila.jugador_id, fila.apodo, normalizarParaComparar(fila.apodo), ahora);
  }

  bd.exec("UPDATE puntuaciones SET apodo = ''");
  console.log(`Migrados ${filas.length} apodos a la tabla de jugadores.`);
}

/**
 * Reserva (o cambia) el apodo de un jugador.
 *
 * Falla si otro jugador ya lo tiene, comparando sin distinguir mayúsculas. Cambiarse el apodo
 * por el que ya tenías no falla: es la misma persona.
 */
export function reclamarApodo(
  bd: DatabaseSync,
  jugadorId: string,
  apodo: string,
  ahora: () => Date = () => new Date(),
): Resultado<string> {
  const normalizado = normalizarParaComparar(apodo);

  const duenyo = bd
    .prepare('SELECT jugador_id FROM jugadores WHERE apodo_normalizado = ?')
    .get(normalizado) as { jugador_id: string } | undefined;

  if (duenyo && duenyo.jugador_id !== jugadorId) {
    return { ok: false, error: 'Ese apodo ya está cogido. Prueba con otro.' };
  }

  try {
    bd.prepare(
      `INSERT INTO jugadores (jugador_id, apodo, apodo_normalizado, actualizado)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(jugador_id) DO UPDATE SET
         apodo = excluded.apodo,
         apodo_normalizado = excluded.apodo_normalizado,
         actualizado = excluded.actualizado`,
    ).run(jugadorId, apodo, normalizado, ahora().toISOString());

    return { ok: true, valor: apodo };
  } catch {
    // El UNIQUE ha saltado: alguien reservó ese apodo entre la comprobación de arriba y esta
    // línea. Improbable, pero es justo para lo que está la restricción en la base de datos.
    return { ok: false, error: 'Ese apodo ya está cogido. Prueba con otro.' };
  }
}

export function tieneApodo(bd: DatabaseSync, jugadorId: string): boolean {
  return bd.prepare('SELECT 1 FROM jugadores WHERE jugador_id = ?').get(jugadorId) !== undefined;
}

interface FilaGuardada {
  mejor1: number;
  mejor2: number;
  mejor3: number;
  logrado: string;
}

/**
 * Guarda las marcas del jugador quedándose con el MEJOR conjunto: se comparan la primera, la
 * segunda y la tercera en ese orden (ver compararMarcas).
 *
 * Es idempotente a propósito: la app reenvía sus mejores marcas cada vez que abre la
 * clasificación, por si alguna se quedó sin subir, así que recibir un conjunto repetido o peor
 * tiene que ser inofensivo.
 *
 * `logrado` solo se actualiza cuando MEJORA la primera marca, porque representa "cuándo llegaste
 * a tu tope actual". Si solo mejoras la segunda, tu antigüedad en el tope no cambia y no debe
 * perder posiciones frente a quien lleva ahí más tiempo.
 */
export function guardarPuntuacion(
  bd: DatabaseSync,
  puntuacion: PuntuacionEntrante,
  ahora: () => Date = () => new Date(),
): Marcas {
  const { jugadorId, modo, marcas } = puntuacion;
  const momento = ahora().toISOString();

  const guardada = bd
    .prepare('SELECT mejor1, mejor2, mejor3, logrado FROM puntuaciones WHERE jugador_id = ? AND modo = ?')
    .get(jugadorId, modo) as FilaGuardada | undefined;

  if (!guardada) {
    bd.prepare(
      `INSERT INTO puntuaciones (jugador_id, modo, mejor1, mejor2, mejor3, logrado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(jugadorId, modo, marcas[0], marcas[1], marcas[2], momento, momento);
    return marcas;
  }

  const previas: Marcas = [guardada.mejor1, guardada.mejor2, guardada.mejor3];

  if (compararMarcas(marcas, previas) <= 0) return previas;

  const logrado = marcas[0] > previas[0] ? momento : guardada.logrado;

  bd.prepare(
    `UPDATE puntuaciones
     SET mejor1 = ?, mejor2 = ?, mejor3 = ?, logrado = ?, actualizado = ?
     WHERE jugador_id = ? AND modo = ?`,
  ).run(marcas[0], marcas[1], marcas[2], logrado, momento, jugadorId, modo);

  return marcas;
}

interface FilaConsulta {
  jugadorId: string;
  apodo: string;
  mejor1: number;
  mejor2: number;
  mejor3: number;
}

function aFila(fila: FilaConsulta): FilaClasificacion {
  return {
    jugadorId: fila.jugadorId,
    apodo: fila.apodo,
    rondas: fila.mejor1,
    marcas: [fila.mejor1, fila.mejor2, fila.mejor3],
  };
}

// Se cruza con `jugadores` con JOIN normal (no LEFT JOIN) a propósito: quien no tenga apodo no
// sale en la clasificación, que es justo la regla — mirar no exige identificarse, aparecer sí.
const SELECT_CLASIFICACION = `
  SELECT p.jugador_id AS jugadorId, j.apodo, p.mejor1, p.mejor2, p.mejor3, p.logrado
  FROM puntuaciones p
  JOIN jugadores j ON j.jugador_id = p.jugador_id
`;

export function leerClasificacion(bd: DatabaseSync, modo: Modo, limite: number): PuestoClasificacion[] {
  const filas = bd
    .prepare(
      `${SELECT_CLASIFICACION}
       WHERE p.modo = ?
       ORDER BY p.mejor1 DESC, p.mejor2 DESC, p.mejor3 DESC, p.logrado ASC
       LIMIT ?`,
    )
    .all(modo, limite) as unknown as FilaConsulta[];

  return asignarPuestos(filas.map(aFila));
}

/**
 * Puesto de un jugador concreto aunque quede fuera de los primeros. Sirve para poder decirle
 * "vas 55.º" a quien no sale en la lista, en vez de dejarlo sin ninguna referencia.
 * Devuelve null si ese jugador no tiene puntuación en ese modo (o no tiene apodo).
 */
export function leerPuestoDe(bd: DatabaseSync, modo: Modo, jugadorId: string): PuestoClasificacion | null {
  const propia = bd
    .prepare(`${SELECT_CLASIFICACION} WHERE p.jugador_id = ? AND p.modo = ?`)
    .get(jugadorId, modo) as (FilaConsulta & { logrado: string }) | undefined;

  if (!propia) return null;

  // Cuánta gente va por delante con el mismo criterio de orden que la clasificación. El puesto
  // es esa cuenta + 1, y como el criterio no admite empates, sale un número exacto.
  const { delante } = bd
    .prepare(
      `SELECT COUNT(*) AS delante
       FROM puntuaciones p
       JOIN jugadores j ON j.jugador_id = p.jugador_id
       WHERE p.modo = ?
         AND ( p.mejor1 > ?
            OR (p.mejor1 = ? AND p.mejor2 > ?)
            OR (p.mejor1 = ? AND p.mejor2 = ? AND p.mejor3 > ?)
            OR (p.mejor1 = ? AND p.mejor2 = ? AND p.mejor3 = ? AND p.logrado < ?) )`,
    )
    .get(
      modo,
      propia.mejor1,
      propia.mejor1,
      propia.mejor2,
      propia.mejor1,
      propia.mejor2,
      propia.mejor3,
      propia.mejor1,
      propia.mejor2,
      propia.mejor3,
      propia.logrado,
    ) as { delante: number };

  return { ...aFila(propia), puesto: delante + 1 };
}

/**
 * Todo, tal cual, para copias de seguridad. **Incluye los identificadores a propósito**: una
 * copia que no permita restaurar quién era cada quién no sirve de nada. Justo por eso la ruta
 * que la expone va protegida con clave (ver index.ts), al contrario que la clasificación
 * pública, que nunca debe llevar identificadores.
 */
export function exportarTodo(bd: DatabaseSync): { jugadores: unknown[]; puntuaciones: unknown[] } {
  return {
    jugadores: bd.prepare('SELECT * FROM jugadores ORDER BY jugador_id').all() as unknown[],
    puntuaciones: bd
      .prepare(
        `SELECT jugador_id, modo, mejor1, mejor2, mejor3, logrado, actualizado
         FROM puntuaciones ORDER BY modo, mejor1 DESC`,
      )
      .all() as unknown[],
  };
}
