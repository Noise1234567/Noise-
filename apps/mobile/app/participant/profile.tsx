import { StyleSheet, View } from 'react-native';

import { logout } from '../../src/auth/session-service';
import { Banner } from '../../src/components/Banner';
import { Button } from '../../src/components/Button';
import { GuestGate } from '../../src/components/GuestGate';
import { Placeholder } from '../../src/components/Placeholder';
import { Screen } from '../../src/components/Screen';
import { SupportButton } from '../../src/components/SupportButton';
import { useSession } from '../../src/state/session';
import { spacing } from '../../src/theme';

/**
 * Écran 16 : Profil Participant. Sans compte (NOISE-075) : invitation à se connecter, sans
 * « Se déconnecter ». Le profil complet, la confirmation de déconnexion et l'activation du rôle
 * arrivent avec NOISE-062.
 */
export default function Profile() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const sessionExpired = useSession((s) => s.sessionExpired);

  if (!signedIn) {
    return (
      <Screen>
        {sessionExpired ? (
          <View style={styles.notice}>
            <Banner kind="info">Votre session a expiré. Reconnectez-vous pour continuer.</Banner>
          </View>
        ) : null}
        <GuestGate
          icon="person-outline"
          title="Vous n'êtes pas connecté"
          message="Connectez-vous ou créez un compte pour acheter des billets et suivre vos soirées."
        />
        <SupportButton />
      </Screen>
    );
  }

  const onLogout = () => void logout();
  return (
    <Placeholder title="Profil" note="Informations du compte, activation du rôle Organisateur.">
      <Button variant="secondary" label="Se déconnecter" onPress={onLogout} />
      <SupportButton />
    </Placeholder>
  );
}

const styles = StyleSheet.create({ notice: { marginBottom: spacing.lg } });
