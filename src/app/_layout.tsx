import { setAudioModeAsync } from 'expo-audio';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';

import { useAppUpdates } from '@/lib/app-updates';
import { preloadTones } from '@/lib/sounds';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useAppUpdates();

  useEffect(() => {
    // El juego se juega de oído: si el iPhone tiene puesto el interruptor de silencio, sin
    // esto no sonaría ni un tono y la partida sería literalmente injugable sin ver la
    // pantalla. Por defecto iOS silencia el audio de la app en ese modo.
    setAudioModeAsync({ playsInSilentMode: true })
      .catch(() => {
        // Si el sistema rechaza la configuración, seguimos: el juego mantiene el háptico y el
        // color, y no tiene sentido tumbar la app por esto.
      })
      .finally(preloadTones);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Sin cabecera propia (headerShown:false, heredado), pero el título sigue haciendo
              falta: es lo que usa el botón Atrás de las pantallas siguientes (game,
              learn-mapping, game-over) cuando vuelven aquí. Sin él, React Navigation cae al
              nombre de la ruta y el botón Atrás decía literalmente "index". */}
          <Stack.Screen name="index" options={{ title: 'Memorios' }} />
          <Stack.Screen name="learn-mapping" options={{ headerShown: true, title: 'Aprender el mapeo' }} />
          {/* gestureEnabled: false — el deslizamiento hacia la derecha es el gesto nativo de
              "volver atrás" de iOS, y le robaba el flick a la derecha a la superficie de juego.
              Se desactiva solo el gesto; el botón Atrás de la cabecera sigue estando. */}
          <Stack.Screen name="game" options={{ headerShown: true, title: 'Partida', gestureEnabled: false }} />
          <Stack.Screen name="game-over" options={{ headerShown: true, title: 'Fin de la partida', gestureEnabled: false }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
