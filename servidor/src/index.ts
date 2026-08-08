import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { abrirBaseDeDatos, guardarPuntuacion, leerClasificacion, leerPuestoDe } from './bd.ts';
import { esJugadorId, esModo, validarPuntuacion } from './validacion.ts';

const PUERTO = Number(process.env.PORT ?? 3000);
// En Railway esto apunta al volumen montado (p. ej. /datos/memorios.db). En local, a una
// carpeta del propio proyecto, ignorada por git.
const RUTA_BD = process.env.RUTA_BD ?? './datos/memorios.db';
const LIMITE_CLASIFICACION = 50;
const MAX_CUERPO_BYTES = 4 * 1024;

// Límite por IP: no es seguridad de verdad (el repositorio es público y la dirección se ve),
// solo evita que un bucle accidental o un curioso llenen la tabla. Ventana deslizante simple
// en memoria; si el servicio se reinicia, se olvida, y no pasa nada.
const PETICIONES_POR_MINUTO = 60;
const contadores = new Map<string, { hasta: number; cuantas: number }>();

function superaLimite(ip: string, ahora: number): boolean {
  const actual = contadores.get(ip);
  if (!actual || ahora > actual.hasta) {
    contadores.set(ip, { hasta: ahora + 60_000, cuantas: 1 });
    return false;
  }
  actual.cuantas += 1;
  return actual.cuantas > PETICIONES_POR_MINUTO;
}

const bd = abrirBaseDeDatos(RUTA_BD);

function responder(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    // La app es nativa y no aplica CORS, pero esto permite probar desde el navegador durante
    // el desarrollo. La API es de solo lectura pública y escritura validada: abrirla no añade
    // riesgo que no tuviera ya.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(texto);
}

async function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];
  let total = 0;

  for await (const trozo of req) {
    total += trozo.length;
    if (total > MAX_CUERPO_BYTES) throw new Error('Cuerpo demasiado grande');
    trozos.push(trozo as Buffer);
  }

  if (total === 0) return null;
  return JSON.parse(Buffer.concat(trozos).toString('utf8'));
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const ruta = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    responder(res, 204, null);
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'desconocida';
  if (superaLimite(ip, Date.now())) {
    responder(res, 429, { error: 'Demasiadas peticiones, prueba en un minuto' });
    return;
  }

  try {
    if (req.method === 'GET' && ruta === '/salud') {
      responder(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && ruta === '/puntuaciones') {
      const validacion = validarPuntuacion(await leerCuerpo(req));
      if (!validacion.ok) {
        responder(res, 400, { error: validacion.error });
        return;
      }

      const guardadas = guardarPuntuacion(bd, validacion.valor);
      responder(res, 200, { ok: true, rondas: guardadas });
      return;
    }

    if (req.method === 'GET' && ruta.startsWith('/clasificacion/')) {
      const modo = ruta.slice('/clasificacion/'.length);
      if (!esModo(modo)) {
        responder(res, 400, { error: 'modo no válido' });
        return;
      }

      const puestos = leerClasificacion(bd, modo, LIMITE_CLASIFICACION);

      // Si el jugador que pregunta no sale entre los primeros, se le devuelve aparte su puesto
      // para que la app pueda decirle dónde está en vez de dejarlo sin referencia.
      const jugadorId = url.searchParams.get('jugadorId');
      const propio =
        esJugadorId(jugadorId) && !puestos.some((p) => p.jugadorId === jugadorId)
          ? leerPuestoDe(bd, modo, jugadorId)
          : null;

      responder(res, 200, { modo, puestos, propio });
      return;
    }

    responder(res, 404, { error: 'Ruta no encontrada' });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    // Se registra entero para poder diagnosticarlo en los logs de Railway, pero al cliente no
    // se le devuelven interioridades.
    console.error('Error atendiendo', req.method, ruta, '-', mensaje);
    responder(res, mensaje === 'Cuerpo demasiado grande' ? 413 : 400, { error: 'Petición no válida' });
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Memorios escuchando en el puerto ${PUERTO} (base de datos: ${RUTA_BD})`);
});
