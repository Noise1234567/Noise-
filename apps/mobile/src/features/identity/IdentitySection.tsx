import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { colors, radii, spacing } from '../../theme';
import { IdentityStatusCard } from './IdentityStatusCard';
import { identityApi } from './identity-api';
import { identityView } from './identity-status';
import { useIdentity } from './useIdentity';

/**
 * Carte de statut d'identité posée sur le tableau de bord (écran 18) et le profil (écran 26).
 * Chargement : squelette ; erreur sans statut connu : message discret avec « Réessayer ».
 */
export function IdentitySection() {
  const { identity, loading, error, retry } = useIdentity(identityApi.get);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <View accessibilityLabel="Chargement du statut d’identité" style={styles.bone} />
      </View>
    );
  }
  if (!identity) {
    return error ? (
      <View style={[styles.wrap, styles.error]}>
        <Text variant="caption" muted>
          {`Statut d’identité indisponible. ${error}`}
        </Text>
        <Button variant="text" label="Réessayer" onPress={() => void retry()} />
      </View>
    ) : null;
  }
  return (
    <View style={styles.wrap}>
      <IdentityStatusCard
        view={identityView(identity)}
        onAction={() => router.push('/organizer/identity')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.md },
  bone: { height: 96, borderRadius: radii.card, backgroundColor: colors.surface },
  error: { gap: spacing.xs },
});
