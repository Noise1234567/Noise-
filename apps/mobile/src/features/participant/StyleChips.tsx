import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '../../components/Text';
import { colors, minTouchTarget, radii, spacing } from '../../theme';
import { STYLE_FILTERS } from './filters';

type Props = { selected: readonly string[]; onChange: (styles: string[]) => void };

/**
 * Rangée de styles défilante (maquette 6). « Tout » vide la sélection ; chaque style se coche ou se
 * décoche, et la liste montre les événements qui ont au moins un des styles cochés.
 */
export function StyleChips({ selected, onChange }: Props) {
  const toggle = (style: string) =>
    onChange(selected.includes(style) ? selected.filter((s) => s !== style) : [...selected, style]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      <Chip label="Tout" active={selected.length === 0} onPress={() => onChange([])} />
      {STYLE_FILTERS.map((style) => (
        <Chip
          key={style}
          label={style}
          active={selected.includes(style)}
          onPress={() => toggle(style)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.active]}
    >
      <Text
        variant="button"
        style={{ fontSize: 14, color: active ? colors.background : colors.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.lg },
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    minHeight: minTouchTarget - 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.text },
});
