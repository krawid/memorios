// Pura y testeable, sin depender de AsyncStorage ni de expo-updates: decide si hay que avisar
// de novedades a partir de los dos identificadores, nada más.
//
// - `idActual` es null en la build embebida (sin actualizar nunca) o fuera de una build real
//   (Expo Go, development): no hay nada que anunciar.
// - `idUltimoVisto` es null la primera vez que este código llega a un dispositivo: no hay con
//   qué comparar, así que solo se memoriza, no se avisa (evita un aviso falso justo al
//   estrenar esta función).
export function debeAvisarNovedades(idUltimoVisto: string | null, idActual: string | null): boolean {
  if (idActual === null || idUltimoVisto === null) return false;
  return idUltimoVisto !== idActual;
}
