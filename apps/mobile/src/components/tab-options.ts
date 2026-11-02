import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

type TabOptions = NonNullable<ComponentProps<typeof Tabs.Screen>['options']>;

/**
 * Écran sans bouton dans la barre d'onglets, mais toujours atteignable par router.push.
 * Ne pas utiliser `href: null` : depuis expo-router 58 (NOISE-071), il cache l'écran ET le rend
 * inatteignable (redirection vers le premier onglet), d'où un appui sur une soirée sans effet.
 */
export const HIDDEN_TAB = { tabBarButton: () => null } satisfies TabOptions;

/** Écran plein écran hors onglets : ni bouton, ni barre d'onglets. */
export const FULL_SCREEN_TAB = {
  ...HIDDEN_TAB,
  tabBarStyle: { display: 'none' },
} satisfies TabOptions;
