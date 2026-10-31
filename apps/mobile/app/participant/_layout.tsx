import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors, fontFamily } from '../../src/theme';

/** Icône d'onglet : contour au repos, pleine quand l'onglet est actif. */
const tabIcon =
  (name: 'musical-notes' | 'ticket' | 'person') =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons
      name={focused ? name : (`${name}-outline` as const)}
      size={size}
      color={color as string}
    />
  );

// Vue Participant : barre d'onglets en bas. Onglet actif en cyan (le violet est réservé à l'action principale).
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
      <Tabs.Screen
        name="index"
        options={{ title: 'Événements', tabBarIcon: tabIcon('musical-notes') }}
      />
      <Tabs.Screen
        name="tickets"
        options={{ title: 'Mes billets', tabBarIcon: tabIcon('ticket') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tabIcon('person') }} />
      {/* Notifications : plein écran, ouvert depuis la cloche (maquette 17). */}
      <Tabs.Screen
        name="notifications"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      {/* Détail d'un événement : plein écran, hors de la barre d'onglets (maquette 7). */}
      <Tabs.Screen name="event/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Tunnel d'achat : plein écran (NOISE-021). */}
      <Tabs.Screen
        name="checkout/[eventId]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      {/* Billet en plein écran avec son QR (NOISE-022). */}
      <Tabs.Screen name="ticket/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
