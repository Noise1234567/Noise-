import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../../theme';
import { POSTER_RATIO } from './EventCard';

/** Carte squelette (maquette 6c) : mêmes dimensions que la vraie carte, donc aucun saut de mise en page. */
export function EventCardSkeleton() {
  return (
    <View
      style={styles.card}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.poster} />
      <View style={styles.body}>
        <View style={styles.lines}>
          <View style={[styles.line, { width: '70%' }]} />
          <View style={[styles.line, { width: '55%' }]} />
        </View>
        <View style={[styles.line, styles.price]} />
      </View>
    </View>
  );
}

const bone = 'rgba(255,255,255,0.08)';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  poster: { width: '100%', aspectRatio: POSTER_RATIO, backgroundColor: bone },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: 64,
  },
  lines: { flex: 1, gap: spacing.sm },
  line: { height: 12, borderRadius: 6, backgroundColor: bone },
  price: { width: 80, height: 18, alignSelf: 'flex-end' },
});
