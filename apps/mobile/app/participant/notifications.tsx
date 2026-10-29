import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { colors, minTouchTarget, spacing } from '../../src/theme';

/**
 * Écran 17 : Notifications. Les notifications push (confirmation d'achat, rappel J-1, annulation)
 * arrivent avec NOISE-028 : en attendant, l'écran existe et annonce honnêtement qu'il est vide.
 */
export default function Notifications() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="section">Notifications</Text>
      </View>
      <View style={styles.empty}>
        <View style={styles.icon}>
          <Ionicons name="notifications-outline" size={28} color={colors.textMuted} />
        </View>
        <Text variant="section">Aucune notification</Text>
        <Text muted style={styles.center}>
          Vos confirmations d’achat et vos rappels de soirée apparaîtront ici.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  back: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center', paddingHorizontal: spacing.xl },
});
