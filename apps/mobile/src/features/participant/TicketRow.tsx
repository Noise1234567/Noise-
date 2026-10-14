import type { TicketTypeDto } from '@noise/shared';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text';
import { colors, radii, spacing } from '../../theme';
import { ticketAvailability, ticketAvailabilityLabel, ticketPriceLabel } from './format';

/** Ligne de billet du détail (maquette 7) : nom, état, prix. Épuisé et vente terminée sont grisés. */
export function TicketRow({ type }: { type: TicketTypeDto }) {
  const state = ticketAvailability(type);
  const dimmed = state === 'SOLD_OUT' || state === 'CLOSED';
  return (
    <View
      style={[styles.row, dimmed && styles.dimmed]}
      accessibilityLabel={`${type.name}, ${ticketAvailabilityLabel(type)}, ${ticketPriceLabel(type)}`}
    >
      <View style={styles.info}>
        <Text variant="body" style={styles.name}>
          {type.name}
        </Text>
        <View style={styles.status}>
          {state === 'SOLD_OUT' ? (
            <Ionicons name="ban-outline" size={14} color={colors.textMuted} />
          ) : null}
          <Text
            variant="caption"
            style={{
              color:
                state === 'LOW'
                  ? colors.warning
                  : state === 'AVAILABLE'
                    ? colors.secondary
                    : colors.textMuted,
            }}
          >
            {ticketAvailabilityLabel(type)}
          </Text>
        </View>
      </View>
      <Text variant="amount" style={dimmed ? styles.priceDimmed : undefined}>
        {ticketPriceLabel(type)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.field,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  dimmed: { opacity: 0.55 },
  info: { flex: 1, gap: spacing.xs },
  name: { fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  priceDimmed: { textDecorationLine: 'line-through' },
});
