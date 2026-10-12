import { Button } from '../../src/components/Button';
import { Placeholder } from '../../src/components/Placeholder';
import { logout } from '../../src/auth/session-service';

/** Écran 26 : Profil Organisateur. */
export default function Profile() {
  const onLogout = () => void logout();
  return (
    <Placeholder
      title="Profil"
      note="Informations du compte, reversements, passage à la vue Participant."
    >
      <Button variant="secondary" label="Se déconnecter" onPress={onLogout} />
    </Placeholder>
  );
}
