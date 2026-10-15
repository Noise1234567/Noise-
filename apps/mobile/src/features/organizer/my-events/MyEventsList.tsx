import type { EventDto } from '@noise/shared';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventsApi } from '../../../api/events';
import { toApiError } from '../../../api/errors';
import { Button } from '../../../components/Button';
import { StateView } from '../../../components/StateView';
import { Text } from '../../../components/Text';
import { colors, radii, spacing } from '../../../theme';
import {
  TAB_LABELS,
  formatCotonouDateTime,
  groupMyEvents,
  salesProgress,
  type EventTab,
} from './group';

type Props = {
  api: Pick<EventsApi, 'listMine'>;
  onCreate: () => void;
  /** Change à chaque retour sur l'écran : la liste est rechargée (après une création). */
  refreshKey?: number;
};

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; events: EventDto[]; nextCursor: string | null };

const TABS: EventTab[] = ['upcoming', 'past', 'cancelled'];

const statusLabel: Record<EventDto['status'], string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  CANCELLED: 'Annulé',
};

/** Écran 19 : « Mes événements », classés à venir / passés / annulés (NOISE-013). */
export function MyEventsList({ api, onCreate, refreshKey = 0 }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [tab, setTab] = useState<EventTab>('upcoming');
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFirstPage = useCallback(async () => {
    setLoad({ kind: 'loading' });
    try {
      const page = await api.listMine();
      setLoad({ kind: 'ready', events: page.data, nextCursor: page.nextCursor });
    } catch (e) {
      setLoad({ kind: 'error', message: toApiError(e).message });
    }
  }, [api]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage, refreshKey]);

  async function loadMore() {
    if (load.kind !== 'ready' || !load.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.listMine(load.nextCursor);
      setLoad({
        kind: 'ready',
        events: [...load.events, ...page.data],
        nextCursor: page.nextCursor,
      });
    } catch {
      // La page déjà affichée reste visible ; le bouton permet de réessayer.
    } finally {
      setLoadingMore(false);
    }
  }

  if (load.kind === 'loading') return <StateView kind="loading" />;
  if (load.kind === 'error') {
    return <StateView kind="error" message={load.message} onRetry={fetchFirstPage} />;
  }
  if (load.events.length === 0) {
    return (
      <View style={styles.flex}>
        <StateView
          kind="empty"
          title="Aucun événement"
          message="Créez votre premier événement : il sera enregistré en brouillon, puis publié quand vous le déciderez."
        />
        <Button label="Créer un événement" onPress={onCreate} />
      </View>
    );
  }

  const groups = groupMyEvents(load.events);
  const shown = groups[tab];

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text variant="title">Mes événements</Text>
        <Button label="Créer un événement" onPress={onCreate} />
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key ? styles.tabActive : null]}
          >
            <Text variant="caption">{`${TAB_LABELS[key]} (${groups[key].length})`}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {shown.length === 0 ? (
          <Text muted style={styles.center}>
            Aucun événement dans cette catégorie.
          </Text>
        ) : (
          shown.map((event) => <EventRow key={event.id} event={event} />)
        )}
        {load.nextCursor ? (
          <Button
            variant="secondary"
            label="Charger plus"
            loading={loadingMore}
            onPress={loadMore}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function EventRow({ event }: { event: EventDto }) {
  const { sold, total } = salesProgress(event);
  return (
    <View style={styles.card} accessibilityLabel={`${event.title}, ${statusLabel[event.status]}`}>
      <View style={styles.cardHeader}>
        <Text variant="button" style={styles.flex}>
          {event.title}
        </Text>
        <Text
          variant="caption"
          style={[styles.badge, event.status === 'PUBLISHED' ? styles.badgeLive : null]}
        >
          {statusLabel[event.status]}
        </Text>
      </View>
      <Text variant="caption" muted>
        {formatCotonouDateTime(event.startsAt)} · {event.venue}, {event.city}
      </Text>
      <Text variant="caption">
        {sold} / {total} billets vendus
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { borderColor: colors.secondary },
  list: { gap: spacing.md, paddingVertical: spacing.lg },
  center: { textAlign: 'center' },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeLive: { borderColor: colors.accent },
});
