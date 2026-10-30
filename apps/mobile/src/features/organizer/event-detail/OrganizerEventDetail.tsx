import type { EventDto } from '@noise/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { ScannerLinksApi } from '../../../api/scanner-links';
import type { EventStatsApi } from '../../../api/stats';
import { toApiError } from '../../../api/errors';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Text } from '../../../components/Text';
import { colors, radii, spacing } from '../../../theme';
import { formatEventRange, formatFcfa } from '../../participant/format';
import { EVENT_STATUS_LABELS, canCreateScannerLink, salesByType } from './event-detail-rules';
import { EventStats } from '../stats/EventStats';
import { ScannerLinks } from './ScannerLinks';

type Props = {
  event: EventDto;
  /** Publie le brouillon (PUT /events/:id) et renvoie l'événement à jour. */
  publish: (eventId: string) => Promise<EventDto>;
  scannerApi: ScannerLinksApi;
  statsApi: EventStatsApi;
  apiBaseUrl: string;
  share: (message: string) => Promise<void>;
  onBack: () => void;
};

/** Message clair quand l'API refuse la publication (identité, billets, date). */
function publishErrorMessage(error: ReturnType<typeof toApiError>): string {
  if (error.code === 'IDENTITY_REQUIRED') {
    return 'Envoyez d’abord votre pièce d’identité (Profil) : elle est obligatoire pour publier.';
  }
  return error.message;
}

/**
 * Détail d'un événement côté organisateur (NOISE-054) : statut, publication d'un brouillon,
 * ventes par type de billet (brouillon) ou statistiques complètes (NOISE-027) et liens scanner
 * pour le staff.
 */
export function OrganizerEventDetail({
  event: initial,
  publish,
  scannerApi,
  statsApi,
  apiBaseUrl,
  share,
  onBack,
}: Props) {
  const [event, setEvent] = useState(initial);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sales = salesByType(event);

  async function doPublish() {
    setError(null);
    setPublishing(true);
    try {
      setEvent(await publish(event.id));
    } catch (e) {
      setError(publishErrorMessage(toApiError(e)));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="caption" style={styles.badge}>
          {EVENT_STATUS_LABELS[event.status]}
        </Text>
        <Text variant="title">{event.title}</Text>
        <Text muted>{formatEventRange(event.startsAt, event.endsAt)}</Text>
        <Text variant="caption" muted>
          {event.venue}, {event.city}
        </Text>
      </View>

      {event.status === 'DRAFT' ? (
        <View style={styles.card}>
          <Text>Ce brouillon n’est pas visible des participants.</Text>
          <Button
            label="Publier l’événement"
            loading={publishing}
            onPress={() => void doPublish()}
          />
        </View>
      ) : null}
      {event.status === 'SUSPENDED' ? (
        <Banner kind="warning">
          Événement suspendu par l’équipe Noise : il n’est plus en vente. Contactez le support.
        </Banner>
      ) : null}
      {event.status === 'CANCELLED' ? (
        <Banner kind="info">Événement annulé : les acheteurs seront remboursés.</Banner>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}

      {event.status === 'DRAFT' ? (
        <View style={styles.card}>
          <Text variant="section">Ventes</Text>
          <Text variant="amount">
            {sales.sold} / {sales.total} billets
          </Text>
          {sales.rows.map((row) => (
            <View key={row.name} style={styles.line}>
              <Text>{row.name}</Text>
              <Text muted>
                {row.sold} / {row.total}
              </Text>
            </View>
          ))}
          <View style={styles.line}>
            <Text variant="button">Vous recevez</Text>
            <Text variant="button">{formatFcfa(sales.netXof)}</Text>
          </View>
          <Text variant="caption" muted>
            Après la commission Noise de 10 %, estimation.
          </Text>
        </View>
      ) : (
        <EventStats eventId={event.id} api={statsApi} />
      )}

      <ScannerLinks
        eventId={event.id}
        eventTitle={event.title}
        canCreate={canCreateScannerLink(event)}
        api={scannerApi}
        apiBaseUrl={apiBaseUrl}
        share={share}
      />

      <Button variant="text" label="Retour à mes événements" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
});
