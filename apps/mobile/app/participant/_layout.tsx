import { Tabs } from 'expo-router';

import { colors, fontFamily } from '../../src/theme';

// Vue Participant : barre d'onglets en bas. Onglet actif en cyan (le vert est réservé à l'action principale).
export default function ParticipantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.interMedium, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Événements' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Mes billets' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
