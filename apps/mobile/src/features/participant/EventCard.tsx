import type { EventDto } from '@noise/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text';
import { colors, radii, spacing } from '../../theme';
import { formatEventDate, priceFromLabel } from './format';

/** Affiche 16:9 (maquette 6). */
export const POSTER_RATIO = 16 / 9;

type Props = { event: EventDto; onPress?: () => void };

/** Carte d'événement de l'accueil (maquette 6) : affiche, pastilles, titre, date, lieu et prix de départ. */
export function EventCard({ event, onPress }: Props) {
  const price = priceFromLabel(event);
  const style = event.styles[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatEventDate(event.startsAt)}, ${event.venue}, ${price}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.posterBox}>
        {event.posterUrl ? (
          <Image
            source={{ uri: event.posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={styles.scrim} />
        <View style={styles.badges}>
          {style ? (
            <View style={styles.chip}>
              <Text variant="caption" style={styles.chipText}>
                {event.styles.length > 1 ? `${style} +${event.styles.length - 1}` : style}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {event.almostFull ? (
            <View style={[styles.chip, styles.almostFull]}>
              <Text variant="caption" style={[styles.chipText, { color: colors.warning }]}>
                Presque complet
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="section" numberOfLines={2} style={styles.title}>
          {event.title}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.meta}>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
            <Text variant="caption" numberOfLines={1} style={styles.metaText}>
              {formatEventDate(event.startsAt)}
            </Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={colors.secondary} />
            <Text variant="caption" numberOfLines={1} style={styles.metaText}>
              {event.venue}
            </Text>
          </View>
        </View>
        <View style={styles.priceBox}>
          {price !== 'Complet' ? (
            <Text variant="caption" muted>
              à partir de
            </Text>
          ) : null}
          <Text variant="amount">{price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.9 },
  posterBox: {
    width: '100%',
    aspectRatio: POSTER_RATIO,
    backgroundColor: colors.toast,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  /** Assombrit le bas de l'affiche pour que le titre reste lisible sur n'importe quelle image. */
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  badges: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: {
    borderRadius: radii.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(10,10,10,0.7)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  almostFull: { borderColor: colors.warning },
  chipText: { fontSize: 12, lineHeight: 16 },
  title: { color: colors.text },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.md,
  },
  meta: { flex: 1, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { flex: 1 },
  priceBox: { alignItems: 'flex-end', justifyContent: 'center' },
});
