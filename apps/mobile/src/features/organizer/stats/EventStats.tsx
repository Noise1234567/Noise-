import type { EventStatsDto } from '@noise/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { toApiError } from '../../../api/errors';
import type { EventStatsApi } from '../../../api/stats';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Text } from '../../../components/Text';
import { colors, radii, spacing } from '../../../theme';
import { formatFcfa } from '../../participant/format';
import {
  STATS_REFRESH_MS,
  barHeights,
  entryRate,
  hasNoSales,
  hourLabel,
  percent,
  timeLabel,
  visibleArrivals,
} from './stats-rules';

type Props = {
  eventId: string;
  api: EventStatsApi;
  /** Délai entre deux rafraîchissements ; réglable pour les tests. */
  refreshMs?: number;
};

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; stats: EventStatsDto; stale: boolean };

const BAR_AREA_HEIGHT = 80;

/** Barre de progression pleine largeur, remplie à `value` %. Décorative : les chiffres sont écrits à côté. */
function Bar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.track} importantForAccessibility="no-hide-descendants">
      <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

/**
 * Statistiques d'un événement (NOISE-027, API GET /events/:id/stats) : ventes par type de
 * billet, revenus, entrées et courbe des arrivées. Se rafraîchit toutes les 30 secondes tant que
 * l'application est au premier plan ; en cas d'échec d'un rafraîchissement, les derniers chiffres
 * restent affichés avec un avertissement.
 */
export function EventStats({ eventId, api, refreshMs = STATS_REFRESH_MS }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setLoad({ kind: 'ready', stats: await api.get(eventId), stale: false });
    } catch (e) {
      setLoad((previous) =>
        previous.kind === 'ready'
          ? { ...previous, stale: true }
          : { kind: 'error', message: toApiError(e).message },
      );
    } finally {
      inFlight.current = false;
    }
  }, [api, eventId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      timer ??= setInterval(() => void refresh(), refreshMs);
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    void refresh();
    start();
    // En arrière-plan on s'arrête ; au retour on rafraîchit aussitôt.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        start();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [refresh, refreshMs]);

  if (load.kind === 'loading') {
    return (
      <View style={styles.card}>
        <Text variant="section">Statistiques</Text>
        <Text muted>Chargement des statistiques…</Text>
      </View>
    );
  }

  if (load.kind === 'error') {
    return (
      <View style={styles.card}>
        <Text variant="section">Statistiques</Text>
        <Banner kind="error">{load.message}</Banner>
        <Button
          variant="secondary"
          label="Réessayer les statistiques"
          onPress={() => void refresh()}
        />
      </View>
    );
  }

  const { stats, stale } = load;
  const arrivals = visibleArrivals(stats.entries.arrivals);
  const heights = barHeights(arrivals, BAR_AREA_HEIGHT);

  return (
    <View style={styles.card}>
      <Text variant="section">Statistiques</Text>
      <Text variant="caption" muted>
        Mis à jour à {timeLabel(stats.generatedAt)}, actualisation automatique
      </Text>
      {stale ? (
        <Banner kind="warning">Mise à jour impossible : derniers chiffres connus affichés.</Banner>
      ) : null}

      {hasNoSales(stats) ? (
        <Text muted>Aucun billet vendu pour le moment.</Text>
      ) : (
        <>
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Text variant="amount">{stats.sales.ticketsSold}</Text>
              <Text variant="caption" muted>
                billets vendus
              </Text>
            </View>
            <View style={styles.figure}>
              <Text variant="amount">{formatFcfa(stats.sales.grossXof)}</Text>
              <Text variant="caption" muted>
                payés par les participants
              </Text>
            </View>
          </View>
          <View style={styles.line}>
            <Text variant="button">Vous recevez</Text>
            <Text variant="button">{formatFcfa(stats.sales.organizerNetXof)}</Text>
          </View>
          <View style={styles.line}>
            <Text muted>Commission Noise</Text>
            <Text muted>{formatFcfa(stats.sales.noiseFeeXof)}</Text>
          </View>

          <Text variant="button">Ventes par type de billet</Text>
          {stats.byType.map((type) => (
            <View key={type.ticketTypeId} style={styles.block}>
              <View style={styles.line}>
                <Text>{type.name}</Text>
                <Text muted>
                  {type.sold} / {type.quantityTotal}
                </Text>
              </View>
              <Bar value={percent(type.sold, type.quantityTotal)} color={colors.accent} />
              <Text variant="caption" muted>
                {type.remaining === 0 ? 'Complet' : `${type.remaining} places restantes`} ·{' '}
                {formatFcfa(type.grossXof)}
              </Text>
            </View>
          ))}

          <Text variant="button">Entrées</Text>
          <View style={styles.line}>
            <Text>Déjà entrés</Text>
            <Text muted>
              {stats.entries.checkedIn} ({entryRate(stats.entries)} %)
            </Text>
          </View>
          <Bar value={entryRate(stats.entries)} color={colors.secondary} />
          <View style={styles.line}>
            <Text>Pas encore entrés</Text>
            <Text muted>{stats.entries.notYetEntered}</Text>
          </View>
          {stats.entries.cancelled > 0 ? (
            <View style={styles.line}>
              <Text>Billets annulés</Text>
              <Text muted>{stats.entries.cancelled}</Text>
            </View>
          ) : null}
          <View style={styles.line}>
            <Text>Scans refusés</Text>
            <Text muted>
              {stats.entries.refusedScans}
              {stats.entries.alreadyUsedScans > 0
                ? ` dont ${stats.entries.alreadyUsedScans} billet(s) déjà utilisé(s)`
                : ''}
            </Text>
          </View>
          {stats.entries.lastEntryAt ? (
            <Text variant="caption" muted>
              Dernière entrée à {timeLabel(stats.entries.lastEntryAt)}
            </Text>
          ) : null}

          {arrivals.length > 0 && stats.entries.checkedIn > 0 ? (
            <View style={styles.block}>
              <Text variant="button">Arrivées par heure</Text>
              <View style={styles.chart}>
                {arrivals.map((bucket, index) => (
                  <View
                    key={bucket.hourStart}
                    style={styles.column}
                    accessible
                    accessibilityLabel={`${hourLabel(bucket.hourStart)} : ${bucket.count} entrée(s)`}
                  >
                    <Text variant="caption" muted>
                      {bucket.count}
                    </Text>
                    <View style={styles.barArea}>
                      <View
                        style={[
                          styles.arrivalBar,
                          { height: heights[index] ?? 0, backgroundColor: colors.secondary },
                        ]}
                      />
                    </View>
                    <Text variant="caption" muted>
                      {hourLabel(bucket.hourStart)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  figures: { flexDirection: 'row', gap: spacing.lg },
  figure: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  block: { gap: spacing.xs },
  track: {
    height: 8,
    borderRadius: radii.chip,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: radii.chip },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  column: { flex: 1, alignItems: 'center', gap: 2 },
  barArea: { height: BAR_AREA_HEIGHT, justifyContent: 'flex-end', alignSelf: 'stretch' },
  arrivalBar: { alignSelf: 'stretch', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
