import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hydrateSession } from '../src/auth/session-service';
import { useSession } from '../src/state/session';
import { colors, fontAssets } from '../src/theme';

void SplashScreen.preventAutoHideAsync();

/**
 * Pile racine. Trois zones, une seule visible à la fois selon la session :
 * authentification, vue Participant, vue Organisateur. Basculer de rôle change la zone visible,
 * sans reconnexion (le jeton reste le même).
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const status = useSession((s) => s.status);
  const activeRole = useSession((s) => s.activeRole);

  useEffect(() => {
    if (fontsLoaded) void hydrateSession();
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && status !== 'loading') void SplashScreen.hideAsync();
  }, [fontsLoaded, status]);

  if (!fontsLoaded || status === 'loading') return null;

  const signedIn = status === 'signedIn';

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && activeRole === 'PARTICIPANT'}>
          <Stack.Screen name="participant" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && activeRole === 'ORGANIZER'}>
          <Stack.Screen name="organizer" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
