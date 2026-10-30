import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors, fontFamily } from '../../src/theme';

/** Icône d'onglet : contour au repos, pleine quand l'onglet est actif. */
const tabIcon =
  (name: 'stats-chart' | 'calendar' | 'person') =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons
      name={focused ? name : (`${name}-outline` as const)}
      size={size}
      color={color as string}
    />
  );

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
      <Tabs.Screen
        name="index"
        options={{ title: 'Tableau de bord', tabBarIcon: tabIcon('stats-chart') }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Mes événements', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tabIcon('person') }} />
      {/* Assistant de création : plein écran, sans onglet ni barre. */}
      <Tabs.Screen name="create-event" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Détail d'un événement (NOISE-054) : hors de la barre d'onglets. */}
      <Tabs.Screen name="event/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Annulation d'un événement : plein écran (NOISE-029). */}
      <Tabs.Screen
        name="cancel-event/[eventId]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      {/* Envoi de la pièce d'identité : atteint depuis la carte de statut, pas depuis la barre d'onglets. */}
      <Tabs.Screen name="identity" options={{ href: null }} />
    </Tabs>
  );
}
