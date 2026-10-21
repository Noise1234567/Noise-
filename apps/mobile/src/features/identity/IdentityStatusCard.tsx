import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { bannerTones } from '../../components/Banner';
import { radii, spacing } from '../../theme';
import type { IdentityView } from './identity-status';

type Props = { view: IdentityView; onAction?: () => void };

/**
 * Carte de statut de la vérification d'identité : ambre en attente, cyan une fois vérifiée,
 * rouge après un refus (mêmes teintes que les bandeaux d'état des maquettes).
 */
export function IdentityStatusCard({ view, onAction }: Props) {
  const tone = bannerTones[view.tone];
  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { borderColor: tone.border, backgroundColor: tone.fill }]}
    >
      <View style={styles.row}>
        <View style={[styles.mark, { backgroundColor: tone.mark }]} />
        <View style={styles.texts}>
          <Text variant="button">{view.title}</Text>
          <Text variant="caption" muted style={styles.message}>
            {view.message}
          </Text>
        </View>
      </View>
      {view.action && onAction ? <Button label={view.action} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, borderWidth: 1, padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', gap: 10 },
  mark: { width: 4, borderRadius: 2 },
  texts: { flex: 1, gap: spacing.xs },
  message: { fontSize: 14, lineHeight: 20 },
});
