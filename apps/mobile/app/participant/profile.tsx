import { Button } from '../../src/components/Button';
import { Placeholder } from '../../src/components/Placeholder';
import { useSession } from '../../src/state/session';

/** Écran 16 : Profil Participant. Déconnexion avec confirmation et activation du rôle : prochaines PR. */
export default function Profile() {
  const signOut = useSession((s) => s.signOut);
  return (
    <Placeholder title="Profil" note="Informations du compte, activation du rôle Organisateur.">
      <Button variant="secondary" label="Se déconnecter" onPress={signOut} />
    </Placeholder>
  );
}
