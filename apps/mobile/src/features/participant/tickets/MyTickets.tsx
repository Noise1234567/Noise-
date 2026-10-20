import type { TicketDto } from '@noise/shared';
import { useEffect, useRef } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { StateView } from '../../../components/StateView';
import { Text } from '../../../components/Text';
import { colors, radii, spacing } from '../../../theme';
import { formatEventDate } from '../format';
import type { TicketCache } from './ticket-cache';
import { TICKET_STATUS_LABELS, formatSyncedAt, groupTickets } from './ticket-list';
import { useMyTickets, type TicketsFetcher } from './useMyTickets';

type Props = {
  fetcher: TicketsFetcher;
  cache: TicketCache;
  userId: string | undefined;
  onOpen: (ticketId: string) => void;
  /** Change à chaque retour sur l'onglet : nouvelle synchronisation. */
  focusKey?: number;
};

/** Écran 14 : Mes billets (NOISE-022). Disponibles hors ligne, synchronisés dès que possible. */
export function MyTickets({ fetcher, cache, userId, onOpen, focusKey = 0 }: Props) {
  const { tickets, syncedAt, refreshing, syncError, refresh } = useMyTickets(
    fetcher,
    cache,
    userId,
  );

  // Retour sur l'onglet (sauf le premier affichage, déjà synchronisé) et retour dans l'app.
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    void refresh();
  }, [focusKey, refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  if (tickets === null) {
    if (syncError) {
      return <StateView kind="error" message={syncError.message} onRetry={refresh} />;
    }
    return <StateView kind="loading" message="Chargement de vos billets…" />;
  }

  const { upcoming, past } = groupTickets(tickets);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.secondary}
          colors={[colors.secondary]}
        />
      }
    >
      <Text variant="title">Mes billets</Text>
      {syncError ? (
        <Banner kind={syncError.offline ? 'warning' : 'error'}>
          {syncError.offline
            ? `Hors ligne. ${syncedAt ? `Billets enregistrés le ${formatSyncedAt(syncedAt)} : ` : ''}vos QR restent utilisables.`
            : `${syncError.message} Billets affichés : ceux déjà enregistrés.`}
        </Banner>
      ) : null}

      {tickets.length === 0 ? (
        <StateView
          kind="empty"
          title="Aucun billet"
          message="Vos billets apparaîtront ici après l'achat, et resteront disponibles sans réseau."
        />
      ) : null}

      {upcoming.length > 0 ? <Section title="À venir" tickets={upcoming} onOpen={onOpen} /> : null}
      {past.length > 0 ? <Section title="Passés" tickets={past} onOpen={onOpen} /> : null}
    </ScrollView>
  );
}

function Section({
  title,
  tickets,
  onOpen,
}: {
  title: string;
  tickets: TicketDto[];
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text variant="section">{title}</Text>
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} onPress={() => onOpen(ticket.id)} />
      ))}
    </View>
  );
}

function TicketCard({ ticket, onPress }: { ticket: TicketDto; onPress: () => void }) {
  const status = TICKET_STATUS_LABELS[ticket.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ticket.eventTitle}, ${ticket.ticketTypeName}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <Text variant="button" style={styles.flex}>
          {ticket.eventTitle}
        </Text>
        <Text
          variant="caption"
          style={[styles.badge, ticket.status === 'VALID' ? styles.badgeValid : styles.badgeOff]}
        >
          {status}
        </Text>
      </View>
      <Text variant="caption" muted>
        {formatEventDate(ticket.eventStartsAt)} · {ticket.venue}, {ticket.city}
      </Text>
      <Text variant="caption">{ticket.ticketTypeName}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.md },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.chip,
    borderWidth: 1,
  },
  badgeValid: { borderColor: colors.secondary },
  badgeOff: { borderColor: colors.border, color: colors.textMuted },
});
