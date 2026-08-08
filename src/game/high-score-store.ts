import AsyncStorage from '@react-native-async-storage/async-storage';

import { insertarMarca, marcasDesdeGuardado, MARCAS_VACIAS, type Marcas } from './marcas';
import { GAME_MODES, GameMode } from './modes';

// Una entrada por modo, no una global: comparar la mejor ronda de "tranqui" con la de "ni de
// coña" no significa nada, tienen dificultades muy distintas.
const claveMarcas = (modo: GameMode) => `memorios.marcas.${modo}`;

// Clave de cuando solo se guardaba una marca por modo. Sigue leyéndose para no borrarle el
// récord a quien ya tenía la app instalada: se lee una vez, se convierte y se guarda en el
// formato nuevo. No se escribe nunca más en ella.
const claveAntigua = (modo: GameMode) => `memorios.highScore.${modo}`;

async function migrarDesdeFormatoAntiguo(modo: GameMode): Promise<Marcas> {
  const crudo = await AsyncStorage.getItem(claveAntigua(modo));
  const anterior = crudo === null ? Number.NaN : Number.parseInt(crudo, 10);

  if (!Number.isFinite(anterior) || anterior <= 0) return MARCAS_VACIAS;

  const marcas: Marcas = [anterior, 0, 0];
  await AsyncStorage.setItem(claveMarcas(modo), JSON.stringify(marcas));
  return marcas;
}

export async function cargarMarcas(modo: GameMode): Promise<Marcas> {
  const crudo = await AsyncStorage.getItem(claveMarcas(modo));

  if (crudo === null) return migrarDesdeFormatoAntiguo(modo);

  try {
    return marcasDesdeGuardado(JSON.parse(crudo));
  } catch {
    // JSON corrupto: mejor empezar de cero en ese modo que impedir jugar.
    return MARCAS_VACIAS;
  }
}

export async function cargarTodasLasMarcas(): Promise<Record<GameMode, Marcas>> {
  const entradas = await Promise.all(GAME_MODES.map(async (modo) => [modo, await cargarMarcas(modo)] as const));
  return Object.fromEntries(entradas) as Record<GameMode, Marcas>;
}

/**
 * Registra una partida terminada y devuelve las tres mejores marcas resultantes.
 *
 * Se guarda SIEMPRE, aunque la partida sea mala: las marcas segunda y tercera son las que
 * deshacen los empates en la clasificación, así que una partida mediocre también cuenta.
 */
export async function registrarPartida(modo: GameMode, rondas: number): Promise<Marcas> {
  const actuales = await cargarMarcas(modo);
  const nuevas = insertarMarca(actuales, rondas);

  await AsyncStorage.setItem(claveMarcas(modo), JSON.stringify(nuevas));
  return nuevas;
}
