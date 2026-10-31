import { StyleSheet, View } from 'react-native';

import { logout } from '../../src/auth/session-service';
import { Banner } from '../../src/components/Banner';
import { GuestGate } from '../../src/components/GuestGate';
import { Screen } from '../../src/components/Screen';
import { SupportButton } from '../../src/components/SupportButton';
import { ParticipantProfile } from '../../src/features/participant/profile/ParticipantProfile';
import { useSession } from '../../src/state/session';
import { spacing } from '../../src/theme';

/**
 * Écran 16 : Profil Participant (NOISE-062). Sans compte (NOISE-075) : invitation à se
 * connecter, sans « Se déconnecter ».
 */
export default function Profile() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const sessionExpired = useSession((s) => s.sessionExpired);
  const user = useSession((s) => s.user);

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

  return (
    <Screen>
      <ParticipantProfile user={user} onLogout={() => void logout()} footer={<SupportButton />} />
    </Screen>
  );
}

const styles = StyleSheet.create({ notice: { marginBottom: spacing.lg } });
