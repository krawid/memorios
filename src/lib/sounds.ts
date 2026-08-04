import { AudioPlayer, createAudioPlayer } from 'expo-audio';

import { Direction } from '@/game/types';

export type SoundKey = Direction | 'fail' | 'reverse';

const sources: Record<SoundKey, number> = {
  up: require('@/assets/audio/tone-up.wav'),
  down: require('@/assets/audio/tone-down.wav'),
  left: require('@/assets/audio/tone-left.wav'),
  right: require('@/assets/audio/tone-right.wav'),
  fail: require('@/assets/audio/tone-fail.wav'),
  reverse: require('@/assets/audio/tone-reverse.wav'),
};

// Dos reproductores por sonido, usados por turnos. Un reproductor que ya llegó al final no
// vuelve a sonar sin rebobinar, y `seekTo` es asíncrono: con un solo reproductor por sonido,
// una dirección repetida podía pedir play() mientras su rebobinado seguía en vuelo y ese tono
// se perdía (se notaba como pitidos que faltan de vez en cuando). Alternando entre dos, el
// reproductor que toca siempre lleva parado más de un segundo.
const POOL_SIZE = 2;

// Se rebobina DESPUÉS de sonar, no antes: así el reproductor está siempre en la posición 0
// esperando, y el disparo del tono es inmediato y síncrono, sin depender de ningún seek.
// Cómodamente por encima del tono más largo (el de fallo, ~390 ms).
const REWIND_DELAY_MS = 500;

// El audio vive fuera de React a propósito: los reproductores se crean una sola vez y no
// dependen del ciclo de vida de ningún componente, así que un re-render a mitad de secuencia
// no puede alterar la reproducción.
let pools: Record<SoundKey, AudioPlayer[]> | null = null;
const cursors: Record<SoundKey, number> = { up: 0, down: 0, left: 0, right: 0, fail: 0, reverse: 0 };

function getPools(): Record<SoundKey, AudioPlayer[]> {
  if (!pools) {
    // Creación perezosa: al primer uso, no al importar el módulo, para no depender de en qué
    // momento del arranque queda listo el módulo nativo de audio.
    // keepAudioSessionActive: por defecto iOS DESACTIVA la sesión de audio cada vez que un
    // reproductor se pausa o termina, y volver a levantarla tarda lo suficiente como para
    // comerse el principio del siguiente sonido. Se notaba en el primer tono de cada ronda,
    // que es justo el que llega tras el silencio de esperar la respuesta del jugador.
    const build = (source: number) =>
      Array.from({ length: POOL_SIZE }, () =>
        createAudioPlayer(source, { keepAudioSessionActive: true }),
      );

    pools = {
      up: build(sources.up),
      down: build(sources.down),
      left: build(sources.left),
      right: build(sources.right),
      fail: build(sources.fail),
      reverse: build(sources.reverse),
    };
  }
  return pools;
}

/**
 * Crea y carga los reproductores por adelantado. Sin esto se crean en el primer `playTone`, y
 * ese primer tono puede perderse mientras se cargan — se llama al arrancar la app para que al
 * empezar a jugar ya esté todo listo.
 */
export function preloadTones() {
  getPools();
}

export function playTone(key: SoundKey) {
  const pool = getPools()[key];
  const player = pool[cursors[key]];
  cursors[key] = (cursors[key] + 1) % POOL_SIZE;

  player.play();

  setTimeout(() => {
    // pause() ANTES de rebobinar, y no solo seekTo(0): al acabar el tono el reproductor no se
    // detiene solo, se queda en estado "reproduciendo" al final de la pista. Rebobinarlo en
    // ese estado no lo deja esperando en la posición 0 — lo hace sonar otra vez entero, que
    // es lo que se oía como sonidos duplicados medio segundo después del original.
    player.pause();
    player.seekTo(0).catch(() => {
      // Si el rebobinado falla, el otro reproductor del par cubre el siguiente disparo.
    });
  }, REWIND_DELAY_MS);
}
