/**
 * Límite de peticiones por IP, en memoria.
 *
 * Qué NO es: seguridad. El repositorio es público y la dirección del servidor va dentro de la
 * app, así que cualquiera puede mandar peticiones a mano. Esto solo evita que un bucle
 * accidental o un curioso llenen la tabla a base de insistir.
 *
 * El reloj se inyecta (`ahora`) para poder probar el caducado sin esperar de verdad — es la
 * regla de la guía compartida para todo lo que dependa del tiempo.
 */

export const VENTANA_MS = 60_000;
export const PETICIONES_POR_VENTANA = 60;

/**
 * A partir de cuántas IPs vigiladas se hace limpieza. Sin esto el Map crece con cada IP nueva
 * y NUNCA se vacía: las entradas caducadas se sobrescriben si esa IP vuelve, pero si no vuelve
 * se quedan ahí para siempre. Con nueve amigos da igual; con mucha gente es una fuga lenta, y
 * en Railway se paga justo por memoria retenida.
 */
const LIMPIAR_A_PARTIR_DE = 1_000;

interface Contador {
  hasta: number;
  cuantas: number;
}

export interface Limitador {
  supera(ip: string, ahora: number): boolean;
  /** Solo para los tests: cuántas IPs se están vigilando ahora mismo. */
  vigiladas(): number;
}

export function crearLimitador(
  peticionesPorVentana: number = PETICIONES_POR_VENTANA,
  ventanaMs: number = VENTANA_MS,
): Limitador {
  const contadores = new Map<string, Contador>();

  function limpiarCaducados(ahora: number): void {
    for (const [ip, contador] of contadores) {
      if (ahora > contador.hasta) contadores.delete(ip);
    }
  }

  return {
    supera(ip: string, ahora: number): boolean {
      // La limpieza se hace aquí, no con un temporizador: sin temporizador no hay nada que
      // mantener vivo ni que parar al apagar el servidor, y el coste se reparte entre
      // peticiones en vez de concentrarse.
      if (contadores.size > LIMPIAR_A_PARTIR_DE) limpiarCaducados(ahora);

      const actual = contadores.get(ip);

      if (!actual || ahora > actual.hasta) {
        contadores.set(ip, { hasta: ahora + ventanaMs, cuantas: 1 });
        return false;
      }

      actual.cuantas += 1;
      return actual.cuantas > peticionesPorVentana;
    },

    vigiladas(): number {
      return contadores.size;
    },
  };
}
