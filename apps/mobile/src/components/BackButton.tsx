import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, minTouchTarget, spacing } from '../theme';

type Props = {
  /** Destination quand il n'y a rien derrière (écran ouvert en premier). */
  fallback: Href;
};

/** Flèche de retour des écrans plein écran : revient en arrière, ou va au repli si la pile est vide. */
export function BackButton({ fallback }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retour"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={styles.back}
    >
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
    marginBottom: spacing.sm,
  },
});
