import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../theme';
import { Text } from './Text';

type Props = { onRetry: () => void };

/** Bandeau « hors ligne » de la maquette 6f : ambre, en haut de l'écran, avec « Réessayer ». */
export function OfflineBar({ onRetry }: Props) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.bar}>
      <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
      <Text variant="caption" style={styles.text}>
        Hors ligne · lecture seule. Vos billets restent disponibles.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Réessayer"
        onPress={onRetry}
        hitSlop={12}
      >
        <Text variant="button" style={styles.retry}>
          Réessayer
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: 'rgba(255,181,71,0.35)',
    backgroundColor: 'rgba(255,181,71,0.1)',
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.warning },
  retry: { fontSize: 14, color: colors.secondary },
});
