import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Placeholder } from '../../src/components/Placeholder';
import { useSession, type AppRole } from '../../src/state/session';
import { spacing } from '../../src/theme';

const roleLabel: Record<AppRole, string> = {
  PARTICIPANT: 'Participant',
  ORGANIZER: 'Organisateur',
};

/** Écran 3 : Inscription. Le formulaire arrive dans la PR suivante (NOISE-008, étape 3). */
export default function Signup() {
  const router = useRouter();
  const pendingRole = useSession((s) => s.pendingRole);
  const signIn = useSession((s) => s.signIn);

  return (
    <Placeholder
      title="Créer votre compte"
      note={`Profil choisi : ${pendingRole ? roleLabel[pendingRole] : 'à choisir'}. Formulaire à venir.`}
    >
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {/* Mode démo, développement uniquement : permet de parcourir la navigation sans API. Retiré avec le vrai formulaire. */}
        {__DEV__ ? (
          <Button
            variant="secondary"
            label="Mode démo (développement)"
            onPress={() => signIn(['PARTICIPANT', 'ORGANIZER'], pendingRole ?? 'PARTICIPANT')}
          />
        ) : null}
        <Button variant="text" label="Modifier mon profil" onPress={() => router.back()} />
      </View>
    </Placeholder>
  );
}
