import { Tabs } from 'expo-router';

import { colors, fontFamily } from '../../src/theme';

// Vue Organisateur : barre d'onglets en bas. Onglet actif en cyan (le violet est réservé à l'action principale).
export default function OrganizerLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Tableau de bord' }} />
      <Tabs.Screen name="events" options={{ title: 'Mes événements' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      {/* Envoi de la pièce d'identité : atteint depuis la carte de statut, pas depuis la barre d'onglets. */}
      <Tabs.Screen name="identity" options={{ href: null }} />
    </Tabs>
  );
}
