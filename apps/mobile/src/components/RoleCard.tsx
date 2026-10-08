import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii } from '../theme';
import { Text } from './Text';

type Props = { title: string; subtitle: string; onPress: () => void };

/** Carte tactile de 72 dp de l'écran de bienvenue. */
export function RoleCard({ title, subtitle, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <Text variant="button">{title}</Text>
        <Text variant="caption" muted>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  texts: { gap: 2 },
});
