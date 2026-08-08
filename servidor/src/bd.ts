import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  asignarPuestos,
  compararMarcas,
  type FilaClasificacion,
  type Marcas,
  type Modo,
  type PuestoClasificacion,
  type PuntuacionEntrante,
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

  bd.exec(`
    CREATE TABLE IF NOT EXISTS puntuaciones (
      jugador_id  TEXT    NOT NULL,
      apodo       TEXT    NOT NULL,
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

  // El orden de la clasificación es exactamente el de este índice, así que lo resuelve sin
  // recorrer la tabla entera ni ordenar en memoria.
  bd.exec(`
    CREATE INDEX IF NOT EXISTS idx_clasificacion
    ON puntuaciones (modo, mejor1 DESC, mejor2 DESC, mejor3 DESC, logrado ASC)
  `);

  return bd;
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
  const { jugadorId, apodo, modo, marcas } = puntuacion;
  const momento = ahora().toISOString();

  const guardada = bd
    .prepare('SELECT mejor1, mejor2, mejor3, logrado FROM puntuaciones WHERE jugador_id = ? AND modo = ?')
    .get(jugadorId, modo) as FilaGuardada | undefined;

  if (!guardada) {
    bd.prepare(
      `INSERT INTO puntuaciones (jugador_id, apodo, modo, mejor1, mejor2, mejor3, logrado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(jugadorId, apodo, modo, marcas[0], marcas[1], marcas[2], momento, momento);
    return marcas;
  }

  const previas: Marcas = [guardada.mejor1, guardada.mejor2, guardada.mejor3];

  if (compararMarcas(marcas, previas) <= 0) {
    // No mejora nada, pero el apodo puede haber cambiado: que se vea el nuevo igualmente.
    bd.prepare('UPDATE puntuaciones SET apodo = ?, actualizado = ? WHERE jugador_id = ? AND modo = ?').run(
      apodo,
      momento,
      jugadorId,
      modo,
    );
    return previas;
  }

  const logrado = marcas[0] > previas[0] ? momento : guardada.logrado;

  bd.prepare(
    `UPDATE puntuaciones
     SET apodo = ?, mejor1 = ?, mejor2 = ?, mejor3 = ?, logrado = ?, actualizado = ?
     WHERE jugador_id = ? AND modo = ?`,
  ).run(apodo, marcas[0], marcas[1], marcas[2], logrado, momento, jugadorId, modo);

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

export function leerClasificacion(bd: DatabaseSync, modo: Modo, limite: number): PuestoClasificacion[] {
  const filas = bd
    .prepare(
      `SELECT jugador_id AS jugadorId, apodo, mejor1, mejor2, mejor3
       FROM puntuaciones
       WHERE modo = ?
       ORDER BY mejor1 DESC, mejor2 DESC, mejor3 DESC, logrado ASC
       LIMIT ?`,
    )
    .all(modo, limite) as unknown as FilaConsulta[];

  return asignarPuestos(filas.map(aFila));
}

/**
 * La tabla entera, tal cual, para copias de seguridad. **Incluye el jugador_id a propósito**:
 * una copia que no permita restaurar quién era cada quién no sirve de nada. Justo por eso la
 * ruta que la expone va protegida con clave (ver index.ts) — es lo contrario de la
 * clasificación pública, que nunca debe llevar identificadores.
 */
export function exportarTodo(bd: DatabaseSync): unknown[] {
  return bd
    .prepare(
      `SELECT jugador_id, apodo, modo, mejor1, mejor2, mejor3, logrado, actualizado
       FROM puntuaciones
       ORDER BY modo, mejor1 DESC`,
    )
    .all() as unknown[];
}

/**
 * Puesto de un jugador concreto aunque quede fuera de los primeros. Sirve para poder decirle
 * "vas 55.º" a quien no sale en la lista, en vez de dejarlo sin ninguna referencia.
 * Devuelve null si ese jugador no tiene puntuación en ese modo.
 */
export function leerPuestoDe(bd: DatabaseSync, modo: Modo, jugadorId: string): PuestoClasificacion | null {
  const propia = bd
    .prepare(
      `SELECT jugador_id AS jugadorId, apodo, mejor1, mejor2, mejor3, logrado
       FROM puntuaciones WHERE jugador_id = ? AND modo = ?`,
    )
    .get(jugadorId, modo) as (FilaConsulta & { logrado: string }) | undefined;

  if (!propia) return null;

  // Cuánta gente va por delante con el mismo criterio de orden que la clasificación. El puesto
  // es esa cuenta + 1, y como el criterio no admite empates, sale un número exacto.
  const { delante } = bd
    .prepare(
      `SELECT COUNT(*) AS delante FROM puntuaciones
       WHERE modo = ?
         AND ( mejor1 > ?
            OR (mejor1 = ? AND mejor2 > ?)
            OR (mejor1 = ? AND mejor2 = ? AND mejor3 > ?)
            OR (mejor1 = ? AND mejor2 = ? AND mejor3 = ? AND logrado < ?) )`,
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
