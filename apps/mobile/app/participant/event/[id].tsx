import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '../../../src/components/Banner';
import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import { POSTER_RATIO } from '../../../src/features/participant/EventCard';
import { TicketRow } from '../../../src/features/participant/TicketRow';
import { eventsApi } from '../../../src/features/participant/events-api';
import {
  formatEventRange,
  isLongDescription,
  purchaseState,
} from '../../../src/features/participant/format';
import { useSession } from '../../../src/state/session';
import { useEvent } from '../../../src/features/participant/useEvent';
import { colors, radii, spacing } from '../../../src/theme';

const CANCELLED_MESSAGE =
  'Événement annulé par l’organisateur. L’achat est impossible. Les remboursements sont traités manuellement par l’équipe Noise.';

/** Écran 7 : Détail événement, avec ses états 7b (complet), 7c (annulé) et 7d (chargement). */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { event, loading, error, retry } = useEvent(eventsApi.get, id);
  const [expanded, setExpanded] = useState(false);
  const signedIn = useSession((st) => st.status === 'signedIn');

  const back = () => (router.canGoBack() ? router.back() : router.replace('/participant'));
  const topButtons = (
    <View style={[styles.topButtons, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <RoundButton icon="chevron-back" label="Retour" onPress={back} />
      {event ? (
        <RoundButton
          icon="share-social-outline"
          label="Partager"
          onPress={() =>
            void Share.share({
              message: `${event.title} · ${formatEventRange(event.startsAt, event.endsAt)} · ${event.venue}, ${event.city}`,
            })
          }
        />
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.root} accessibilityLabel="Chargement de l’événement">
        <View style={styles.poster} />
        {topButtons}
        <View style={styles.content}>
          <View style={[styles.bone, { width: 90, height: 22 }]} />
          <View style={[styles.bone, { width: '80%', height: 28, marginTop: spacing.md }]} />
          <View style={[styles.bone, { width: '60%', marginTop: spacing.lg }]} />
          <View style={[styles.bone, { width: '70%', marginTop: spacing.sm }]} />
          <View style={[styles.bone, { height: 64, marginTop: spacing.xl }]} />
          <View style={[styles.bone, { height: 64, marginTop: spacing.sm }]} />
        </View>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.root}>
        {topButtons}
        <View style={styles.errorBox}>
          <Text variant="section">
            {error?.notFound ? 'Événement introuvable' : 'Impossible de charger l’événement'}
          </Text>
          <Text muted style={styles.center}>
            {error?.notFound
              ? 'Il a peut-être été retiré par son organisateur.'
              : 'Votre connexion semble faible.'}
          </Text>
          {error?.notFound ? (
            <Button variant="secondary" label="Retour aux événements" onPress={back} />
          ) : (
            <Button variant="secondary" label="Réessayer" onPress={() => void retry()} />
          )}
        </View>
      </View>
    );
  }

  const purchase = purchaseState(event);
  const long = isLongDescription(event.description);
  const openMap = () =>
    void Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.city}`)}`,
    );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.poster}>
          {event.posterUrl ? (
            <Image
              source={{ uri: event.posterUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View style={styles.content}>
          <View style={styles.chips}>
            {event.styles.map((style) => (
              <View key={style} style={styles.chip}>
                <Text variant="caption" style={styles.chipText}>
                  {style}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="title" style={styles.title}>
            {event.title}
          </Text>
          <Text variant="caption" muted style={styles.organizer}>
            {`par ${event.organizerName}`}
          </Text>

          {event.status === 'CANCELLED' ? (
            <View style={styles.banner}>
              <Banner kind="error">{CANCELLED_MESSAGE}</Banner>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
            <Text style={styles.infoText}>{formatEventRange(event.startsAt, event.endsAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.secondary} />
            <Text style={styles.infoText}>{`${event.venue} · ${event.city}`}</Text>
            <Pressable accessibilityRole="link" onPress={openMap} hitSlop={8}>
              <Text variant="button" style={styles.link}>
                Itinéraire
              </Text>
            </Pressable>
          </View>

          <Text numberOfLines={expanded ? undefined : 3} style={styles.description}>
            {event.description}
          </Text>
          {long ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpanded((value) => !value)}
              hitSlop={8}
            >
              <Text variant="button" style={styles.link}>
                {expanded ? 'Réduire' : 'Lire la suite'}
              </Text>
            </Pressable>
          ) : null}

          <Text variant="section" style={styles.sectionTitle}>
            Billets
          </Text>
          {event.ticketTypes.length === 0 ? (
            <Text muted>Aucun billet n’est en vente pour le moment.</Text>
          ) : (
            event.ticketTypes.map((type) => <TicketRow key={type.id} type={type} />)
          )}
        </View>
      </ScrollView>

      {topButtons}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={purchase.label}
          disabled={purchase.kind !== 'OPEN'}
          onPress={() =>
            // Sans compte, l'achat passe d'abord par la connexion (NOISE-075), qui rend ensuite cet écran.
            signedIn
              ? router.push({
                  pathname: '/participant/checkout/[eventId]',
                  params: { eventId: event.id },
                })
              : router.push('/login')
          }
        />
        {purchase.kind !== 'OPEN' ? (
          <Text variant="caption" muted style={styles.hint}>
            {purchase.hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'share-social-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.round}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  poster: { width: '100%', aspectRatio: POSTER_RATIO, backgroundColor: colors.toast },
  topButtons: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.7)',
  },
  content: { padding: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderRadius: radii.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: 12, lineHeight: 16 },
  title: { marginBottom: spacing.xs },
  organizer: { marginBottom: spacing.lg },
  banner: { marginBottom: spacing.lg },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: { flex: 1 },
  link: { color: colors.secondary, fontSize: 14 },
  description: { marginTop: spacing.md, marginBottom: spacing.xs },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { textAlign: 'center' },
  bone: { height: 14, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
});
