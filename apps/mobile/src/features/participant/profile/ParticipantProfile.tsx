import type { PublicUser } from '@noise/shared';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { displayPhone } from '../../../auth/forms';
import { Button } from '../../../components/Button';
import { Text } from '../../../components/Text';
import { colors, radii, spacing } from '../../../theme';

type Props = {
  user: PublicUser | null;
  onLogout: () => void;
};

/**
 * Écran 16 : Profil participant (NOISE-062). Compte et déconnexion confirmée : la déconnexion
 * efface les billets enregistrés sur le téléphone (NOISE-022), d'où la confirmation.
 */
export function ParticipantProfile({ user, onLogout }: Props) {
  const confirmLogout = () =>
    Alert.alert(
      'Se déconnecter ?',
      'Vos billets enregistrés sur ce téléphone seront effacés. Vous les retrouverez en vous reconnectant.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: onLogout },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="title">Profil</Text>

      <View style={styles.card}>
        <Text variant="button">{user?.name ?? ''}</Text>
        <Text muted>{displayPhone(user?.phone)}</Text>
        {user?.email ? <Text muted>{user.email}</Text> : null}
      </View>

      <Text variant="caption" muted>
        Vos billets restent disponibles hors ligne sur ce téléphone tant que vous êtes connecté.
      </Text>

      <View style={styles.actions}>
        <Button variant="secondary" label="Se déconnecter" onPress={confirmLogout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  actions: { gap: spacing.md, marginTop: spacing.md },
});
