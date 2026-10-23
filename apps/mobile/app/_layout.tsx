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
 * authentification, vue Participant, vue Organisateur. Un compte n'a qu'un rôle (DEC-029) : la
 * vue est celle du compte connecté.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const status = useSession((s) => s.status);
  const role = useSession((s) => s.role);

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
        <Stack.Protected guard={signedIn && role === 'PARTICIPANT'}>
          <Stack.Screen name="participant" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && role === 'ORGANIZER'}>
          <Stack.Screen name="organizer" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
