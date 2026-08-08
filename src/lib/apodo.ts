/**
 * Reglas del apodo. Puro y testeable, sin AsyncStorage ni red.
 *
 * ⚠️ Estas reglas están **a propósito duplicadas** con las del servidor
 * (`servidor/src/validacion.ts`). No es un descuido: el servidor NO puede fiarse de la app —
 * cualquiera puede mandarle una petición a mano — así que valida por su cuenta pase lo que
 * pase. Y la app valida también para poder decírselo a la persona al momento, en vez de
 * después de un viaje de ida y vuelta.
 *
 * Si se cambian aquí, hay que cambiarlas allí. El límite y el motivo son los mismos.
 */

export const MAX_APODO = 20;

/**
 * Recorta, junta los espacios de dentro y rechaza caracteres de control (que un lector de
 * pantalla lee fatal, y que en una lista rompen el renderizado).
 * Devuelve null si no queda un apodo utilizable.
 */
export function normalizarApodo(valor: string): string | null {
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo < 0x20 || codigo === 0x7f) return null;
  }

  const limpio = valor.trim().replace(/\s+/g, ' ');
  if (limpio.length === 0 || limpio.length > MAX_APODO) return null;
  return limpio;
}

/** Mensaje para la persona cuando el apodo no vale. null si vale. */
export function errorDeApodo(valor: string): string | null {
  if (valor.trim().length === 0) return 'Escribe un apodo para aparecer en la clasificación.';
  if (normalizarApodo(valor) === null) {
    return `El apodo no puede pasar de ${MAX_APODO} caracteres ni llevar saltos de línea.`;
  }
  return null;
}
