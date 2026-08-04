import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlickSurface } from '@/components/flick-surface';
import { GameBoard } from '@/components/game-board';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MODE_LABELS } from '@/constants/mode-presentation';
import { Spacing } from '@/constants/theme';
import { createInitialEngineState, expectedOrder, reduceEngine, scoreFromState } from '@/game/engine';
import { saveHighScoreIfBetter } from '@/game/high-score-store';
import { GAME_MODES, GameMode, MODE_CONFIG, playbackTimingForRound } from '@/game/modes';
import { evaluateInput } from '@/game/round-evaluator';
import { createSeededRandom } from '@/game/seeded-random';
import { Direction } from '@/game/types';
import { triggerDirectionHaptic, triggerFailHaptic, triggerReverseHaptic } from '@/lib/haptics';
import { playTone } from '@/lib/sounds';
import { wait } from '@/lib/wait';

const PRE_SEQUENCE_DELAY_MS = 600;
// El propio aviso dura 300ms; este margen deja que termine del todo (más el doble pulso
// háptico, ~240ms) antes de arrancar el primer tono de la secuencia, para que no se solapen.
const REVERSE_CUE_MS = 500;
const GAME_OVER_TRANSITION_DELAY_MS = 900;

function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && (GAME_MODES as readonly string[]).includes(value);
}

export default function GameScreen() {
  const router = useRouter();
  const { mode: modeParam, seed, pasaloPlayer, player1Score } = useLocalSearchParams<{
    mode?: string;
    seed?: string;
    pasaloPlayer?: string;
    player1Score?: string;
  }>();
  // 'tranqui' de respaldo si se entra sin parámetro de modo (no debería pasar desde el menú,
  // pero un enlace directo o un parámetro corrupto no debe tumbar la partida).
  const mode: GameMode = isGameMode(modeParam) ? modeParam : 'tranqui';
  const modeConfig = MODE_CONFIG[mode];
  const isPasalo = pasaloPlayer === '1' || pasaloPlayer === '2';

  // Estable durante toda la vida de la pantalla (por eso useState y no un valor calculado en
  // cada render): con semilla, cada llamada avanza el generador — si se recreara en cada
  // render, se reiniciaría constantemente y las tiradas de los dos jugadores dejarían de
  // coincidir. Sin semilla (partida normal), Math.random de siempre.
  const [random] = useState(() => (seed !== undefined ? createSeededRandom(Number(seed)) : Math.random));

  const [engineState, setEngineState] = useState(() =>
    createInitialEngineState({ allowsReversal: modeConfig.allowsReversal, random }),
  );
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  // La partida no arranca sola al entrar en la pantalla: arranca con el primer toque del
  // jugador. Intentamos antes sincronizar el primer tono con el anuncio automático de
  // VoiceOver al cambiar de pantalla (con un margen fijo, luego con `announcementFinished`) y
  // los dos fallaron — ese anuncio lo dispara el sistema por su cuenta y no hay forma fiable
  // de saber desde JS cuándo termina. Dejar que el propio jugador decida cuándo empezar
  // elimina la carrera del todo: no hay nada que adivinar si el tono solo suena después de
  // que la persona ya haya actuado.
  const [started, setStarted] = useState(false);

  const { phase, sequence, reversed } = engineState;
  const score = scoreFromState(engineState);

  useEffect(() => {
    if (!started || phase !== 'playingSequence') return;
    let cancelled = false;

    // Sin ningún anuncio de voz durante la partida, tampoco al empezar la ronda 1: aunque el
    // aviso ya haya terminado de hablarse, la atenuación de audio de VoiceOver sobre el resto
    // de sonidos de la app sigue un instante más, y el primer tono salía por debajo del
    // volumen normal. El estado se comunica solo con tonos y háptico.
    async function playback() {
      await wait(PRE_SEQUENCE_DELAY_MS);

      if (reversed) {
        // El aviso de ronda invertida (barrido descendente + doble pulso) es la única señal
        // de que esta ronda hay que responderla al revés — nada de texto ni voz, mismo canal
        // que el resto del juego.
        playTone('reverse');
        triggerReverseHaptic();
        if (cancelled) return;
        await wait(REVERSE_CUE_MS);
      }

      const { toneOnMs, toneGapMs } = playbackTimingForRound(sequence.length, modeConfig.accelerates);

      for (const direction of sequence) {
        if (cancelled) return;
        playTone(direction);
        triggerDirectionHaptic(direction);
        setActiveDirection(direction);
        await wait(toneOnMs);
        if (cancelled) return;
        setActiveDirection(null);
        await wait(toneGapMs);
      }

      if (cancelled) return;
      setEngineState((current) => reduceEngine(current, { type: 'sequencePlaybackFinished' }, random));
    }

    playback();
    return () => {
      cancelled = true;
    };
  }, [started, phase, sequence, reversed, modeConfig, random]);

  useEffect(() => {
    if (phase !== 'gameOver') return;
    // En Pásalo no se guarda: es un duelo entre dos personas concretas, no una puntuación
    // personal comparable con las de en solitario — mezclarlas no significaría nada.
    if (isPasalo) return;
    // Se guarda de inmediato, no detrás de la pausa de la transición de abajo: esa pausa es
    // solo para que el cambio de pantalla no sea brusco, la puntuación no tiene por qué
    // esperarla. Cuanto menos tiempo pase entre terminar la partida y persistirla, menos
    // ventana hay para que algo (la app cerrándose, una recarga) la deje sin guardar.
    saveHighScoreIfBetter(mode, score);
  }, [phase, isPasalo, mode, score]);

  useEffect(() => {
    if (phase !== 'gameOver') return;

    const timeout = setTimeout(() => {
      if (isPasalo) {
        if (pasaloPlayer === '1') {
          // Le toca al Jugador 2 — la misma semilla, así se enfrenta a la secuencia idéntica.
          router.replace({
            pathname: '/pasalo-turno',
            params: { mode, seed, player: '2', player1Score: String(score) },
          });
        } else {
          router.replace({
            pathname: '/pasalo-resultado',
            params: { mode, player1Score: player1Score ?? '0', player2Score: String(score) },
          });
        }
        return;
      }

      router.replace({
        pathname: '/game-over',
        params: {
          mode,
          score: String(score),
          // El orden que se muestra/anuncia es el que había que responder de verdad (ya
          // invertido si tocaba), no el de generación — es el que explica por qué falló.
          sequence: expectedOrder(sequence, reversed).join(','),
          reversed: reversed ? '1' : '0',
        },
      });
    }, GAME_OVER_TRANSITION_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [phase, score, sequence, reversed, mode, isPasalo, pasaloPlayer, seed, player1Score, router]);

  function handleTouchStart() {
    if (!started) {
      setStarted(true);
    }
  }

  function handleFlick(direction: Direction) {
    if (phase !== 'awaitingInput') return;

    const result = evaluateInput(sequence, engineState.inputIndex, direction, reversed);

    setActiveDirection(direction);
    setTimeout(() => setActiveDirection(null), 200);

    if (result.outcome === 'incorrect') {
      // El tono de fallo y su vibración ya avisan del error. El resumen hablado (con la
      // secuencia correcta) lo da la pantalla de fin de partida, donde no compite con ningún
      // tono; anunciarlo aquí lo pisaba.
      playTone('fail');
      triggerFailHaptic();
    } else {
      playTone(direction);
      triggerDirectionHaptic(direction);
    }

    setEngineState((current) => reduceEngine(current, { type: 'input', direction }, random));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Oculto a VoiceOver como el tablero: su texto cambia justo al empezar y terminar la
            reproducción, y si el foco cayera aquí, VoiceOver lo releería en voz alta encima de
            los tonos. En esta pantalla el único elemento accesible es la superficie de flick. */}
        <ThemedText
          type="default"
          themeColor="textSecondary"
          style={styles.status}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {isPasalo ? `Pásalo — Jugador ${pasaloPlayer}` : MODE_LABELS[mode]}
          {'\n'}
          {!started
            ? 'Toca para empezar'
            : phase === 'playingSequence'
              ? 'Escuchando…'
              : `Ronda ${sequence.length}`}
        </ThemedText>

        <ThemedView style={styles.boardWrapper}>
          <GameBoard activeDirection={activeDirection} roundNumber={sequence.length} reversed={reversed} />
        </ThemedView>
      </SafeAreaView>

      <FlickSurface
        onFlick={handleFlick}
        onTouchStart={handleTouchStart}
        disabled={started && phase !== 'awaitingInput'}
        accessibilityLabel={started ? 'Superficie de juego' : 'Toca para empezar la partida'}
        accessibilityHint={
          started
            ? 'Desliza el dedo en la dirección del color que quieras repetir: arriba, abajo, izquierda o derecha.'
            : 'Toca en cualquier punto de la pantalla cuando estés listo para empezar.'
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  status: {
    fontSize: 18,
    textAlign: 'center',
  },
  boardWrapper: {
    backgroundColor: 'transparent',
  },
});
