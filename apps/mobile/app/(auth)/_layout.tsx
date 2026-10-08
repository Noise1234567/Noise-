import { Stack } from 'expo-router';

import { colors } from '../../src/theme';

// Pile d'authentification : sans barre d'onglets.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
