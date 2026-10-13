import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../theme';
import { Text } from './Text';

const tones = {
  error: { mark: colors.error, border: 'rgba(255,90,95,0.35)', fill: 'rgba(255,90,95,0.1)' },
  warning: { mark: colors.warning, border: 'rgba(255,181,71,0.35)', fill: 'rgba(255,181,71,0.1)' },
  info: { mark: colors.secondary, border: 'rgba(0,196,255,0.35)', fill: 'rgba(0,196,255,0.1)' },
} as const;

type Props = { kind: 'error' | 'warning' | 'info'; children: string };

/** Bandeau d'état des maquettes (3b–3d, 4b–4d) : rouge pour une erreur, ambre pour une attente, cyan pour une information. */
export function Banner({ kind, children }: Props) {
  const tone = tones[kind];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { borderColor: tone.border, backgroundColor: tone.fill }]}
    >
      <View style={[styles.mark, { backgroundColor: tone.mark }]} />
      <Text variant="caption" style={styles.text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radii.field, borderWidth: 1 },
  mark: { width: 4, borderRadius: 2 },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
});
