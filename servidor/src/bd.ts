import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { asignarPuestos, type FilaClasificacion, type Modo, type PuestoClasificacion, type PuntuacionEntrante } from './validacion.ts';

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
      rondas      INTEGER NOT NULL,
      actualizado TEXT    NOT NULL,
      PRIMARY KEY (jugador_id, modo)
    )
  `);

  // Una consulta de clasificación filtra por modo y ordena por rondas: este índice la resuelve
  // sin recorrer la tabla entera.
  bd.exec('CREATE INDEX IF NOT EXISTS idx_modo_rondas ON puntuaciones (modo, rondas DESC)');

  return bd;
}

/**
 * Guarda la puntuación quedándose SIEMPRE con la más alta. Es idempotente a propósito: la app
 * reenvía sus mejores marcas cada vez que abre la clasificación (por si alguna se quedó sin
 * subir), así que recibir una puntuación repetida o más baja tiene que ser inofensivo.
 *
 * Devuelve la puntuación que queda guardada tras la operación.
 */
export function guardarPuntuacion(
  bd: DatabaseSync,
  puntuacion: PuntuacionEntrante,
  ahora: () => Date = () => new Date(),
): number {
  const { jugadorId, apodo, modo, rondas } = puntuacion;

  bd.prepare(
    `INSERT INTO puntuaciones (jugador_id, apodo, modo, rondas, actualizado)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(jugador_id, modo) DO UPDATE SET
       rondas      = MAX(rondas, excluded.rondas),
       -- El apodo se actualiza siempre: si alguien se lo cambia, que se vea el nuevo aunque
       -- no haya batido su marca.
       apodo       = excluded.apodo,
       actualizado = CASE WHEN excluded.rondas > rondas THEN excluded.actualizado ELSE actualizado END`,
  ).run(jugadorId, apodo, modo, rondas, ahora().toISOString());

  const fila = bd
    .prepare('SELECT rondas FROM puntuaciones WHERE jugador_id = ? AND modo = ?')
    .get(jugadorId, modo) as { rondas: number } | undefined;

  return fila?.rondas ?? rondas;
}

export function leerClasificacion(bd: DatabaseSync, modo: Modo, limite: number): PuestoClasificacion[] {
  const filas = bd
    .prepare(
      `SELECT jugador_id AS jugadorId, apodo, rondas
       FROM puntuaciones
       WHERE modo = ?
       ORDER BY rondas DESC, actualizado ASC
       LIMIT ?`,
    )
    .all(modo, limite) as unknown as FilaClasificacion[];

  return asignarPuestos(filas);
}

/**
 * Puesto de un jugador concreto aunque quede fuera de los primeros. Sirve para poder decirle
 * "vas 23.º" a quien no sale en la lista, en vez de dejarlo sin ninguna referencia.
 * Devuelve null si ese jugador no tiene puntuación en ese modo.
 */
export function leerPuestoDe(bd: DatabaseSync, modo: Modo, jugadorId: string): PuestoClasificacion | null {
  const propia = bd
    .prepare('SELECT jugador_id AS jugadorId, apodo, rondas FROM puntuaciones WHERE jugador_id = ? AND modo = ?')
    .get(jugadorId, modo) as unknown as FilaClasificacion | undefined;

  if (!propia) return null;

  // Empates compartidos: el puesto es cuánta gente tiene ESTRICTAMENTE más rondas, +1.
  const { mejores } = bd
    .prepare('SELECT COUNT(*) AS mejores FROM puntuaciones WHERE modo = ? AND rondas > ?')
    .get(modo, propia.rondas) as { mejores: number };

  return { ...propia, puesto: mejores + 1 };
}
