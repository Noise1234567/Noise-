import { Pressable, StyleSheet, View } from 'react-native';

import type { AppRole } from '../state/session';
import { colors, minTouchTarget, radii } from '../theme';
import { Text } from './Text';

const labels: Record<AppRole, string> = { PARTICIPANT: 'Participant', ORGANIZER: 'Organisateur' };

type Props = {
  active: AppRole;
  onSelect: (role: AppRole) => void;
};

/** Contrôle segmenté en haut de l'écran principal de chaque vue. Segment actif : plein #E8E8E8, texte noir. */
export function RoleSwitcher({ active, onSelect }: Props) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {(Object.keys(labels) as AppRole[]).map((role) => {
        const selected = role === active;
        return (
          <Pressable
            key={role}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(role)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              variant="button"
              style={{ color: selected ? colors.background : colors.textMuted, fontSize: 14 }}
            >
              {labels[role]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: minTouchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.field,
  },
  selected: { backgroundColor: colors.text },
});
