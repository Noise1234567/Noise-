import { Button } from '../../src/components/Button';
import { Placeholder } from '../../src/components/Placeholder';
import { useSession } from '../../src/state/session';

/** Écran 26 : Profil Organisateur. */
export default function Profile() {
  const signOut = useSession((s) => s.signOut);
  return (
    <Placeholder
      title="Profil"
      note="Informations du compte, reversements, passage à la vue Participant."
    >
      <Button variant="secondary" label="Se déconnecter" onPress={signOut} />
    </Placeholder>
  );
}
