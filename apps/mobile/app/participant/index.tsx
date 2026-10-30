import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { OfflineBar } from '../../src/components/OfflineBar';
import { Button } from '../../src/components/Button';
import { RoleHeader } from '../../src/components/RoleHeader';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { EventCard } from '../../src/features/participant/EventCard';
import { EventCardSkeleton } from '../../src/features/participant/EventCardSkeleton';
import { PickerPill } from '../../src/features/participant/PickerPill';
import { StyleChips } from '../../src/features/participant/StyleChips';
import { eventsApi } from '../../src/features/participant/events-api';
import {
  CITIES,
  DEFAULT_CITY,
  dateLabel,
  dateOptions,
} from '../../src/features/participant/filters';
import { useEventList } from '../../src/features/participant/useEventList';
import { colors, minTouchTarget, spacing } from '../../src/theme';

/** Écran 6 : Accueil Événements (vue Participant), avec ses états 6c à 6f. */
export default function Home() {
  const [selectedStyles, setStyles] = useState<string[]>([]);
  const [city, setCity] = useState<string | undefined>(DEFAULT_CITY);
  const [date, setDate] = useState<string | undefined>(undefined);

  const list = useEventList(eventsApi.list, { styles: selectedStyles, city, date });
  const days = useMemo(() => dateOptions(), []);
  const filtered = selectedStyles.length > 0 || city !== DEFAULT_CITY || date !== undefined;

  const resetFilters = () => {
    setStyles([]);
    setCity(DEFAULT_CITY);
    setDate(undefined);
  };

  // Erreur sur un rafraîchissement ou une page suivante alors qu'une liste est déjà affichée :
  // on garde la liste en lecture seule et on le dit (maquette 6f), plutôt que d'effacer l'écran.
  const offline = list.error?.network === true && list.events.length > 0;

  return (
    <Screen>
      {offline ? <OfflineBar onRetry={list.retry} /> : null}
      <View style={styles.header}>
        <View style={styles.switcher}>
          <RoleHeader />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push('/participant/notifications')}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text variant="title" style={styles.title}>
        Événements
      </Text>

      <View style={styles.pills}>
        <PickerPill
          icon="location-outline"
          title="Ville"
          label={city ?? 'Toutes les villes'}
          selected={city}
          onSelect={setCity}
          options={[
            ...CITIES.map((value) => ({ value: value as string | undefined, label: value })),
            { value: undefined, label: 'Toutes les villes' },
          ]}
        />
        <PickerPill
          icon="calendar-outline"
          title="Date"
          label={dateLabel(date)}
          selected={date}
          onSelect={setDate}
          options={days}
        />
      </View>
      <StyleChips selected={selectedStyles} onChange={setStyles} />

      {list.loading ? (
        <View accessibilityLabel="Chargement des soirées" accessibilityLiveRegion="polite">
          {[0, 1, 2].map((key) => (
            <EventCardSkeleton key={key} />
          ))}
        </View>
      ) : list.error && list.events.length === 0 ? (
        <View style={styles.state}>
          <Text variant="section">Impossible de charger les soirées</Text>
          <Text muted style={styles.center}>
            Votre connexion semble faible. Vos billets restent dans Mes billets.
          </Text>
          <Button label="Réessayer" onPress={list.retry} />
        </View>
      ) : list.events.length === 0 ? (
        <View style={styles.state}>
          <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
          <Text variant="section">Aucun festival pour le moment</Text>
          <Text muted style={styles.center}>
            Essayez un autre genre ou une autre date.
          </Text>
          {filtered ? (
            <Button variant="secondary" label="Réinitialiser les filtres" onPress={resetFilters} />
          ) : null}
        </View>
      ) : (
        <FlatList
          data={list.events}
          keyExtractor={(event) => event.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() =>
                router.push({ pathname: '/participant/event/[id]', params: { id: item.id } })
              }
            />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={list.refresh}
              tintColor={colors.secondary}
            />
          }
          // La page suivante se charge quand il reste environ 2 cartes (maquette 6).
          onEndReached={list.loadMore}
          onEndReachedThreshold={1.5}
          ListFooterComponent={list.loadingMore ? <EventCardSkeleton /> : undefined}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  switcher: { flex: 1, marginRight: spacing.lg },
  title: { marginBottom: spacing.lg },
  bell: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: minTouchTarget / 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
});
