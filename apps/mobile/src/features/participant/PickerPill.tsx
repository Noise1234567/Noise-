import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text';
import { colors, minTouchTarget, radii, spacing } from '../../theme';

export type PickerOption<T> = { value: T; label: string };

type Props<T> = {
  icon: 'location-outline' | 'calendar-outline';
  label: string;
  title: string;
  options: PickerOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

/** Pilule de filtre (ville, date) qui ouvre une feuille de choix (maquette 6). */
export function PickerPill<T>({ icon, label, title, options, selected, onSelect }: Props<T>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} : ${label}`}
        onPress={() => setOpen(true)}
        style={styles.pill}
      >
        <Ionicons name={icon} size={16} color={colors.secondary} />
        <Text variant="button" numberOfLines={1} style={styles.pillText}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Fermer"
        />
        <View style={styles.sheet}>
          <Text variant="section" style={styles.sheetTitle}>
            {title}
          </Text>
          <ScrollView>
            {options.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  style={styles.option}
                >
                  <Text style={active ? { color: colors.secondary } : undefined}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.secondary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.field,
    backgroundColor: colors.surface,
  },
  pillText: { flex: 1, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetTitle: { marginBottom: spacing.md },
  option: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
