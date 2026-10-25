import { logout } from '../../src/auth/session-service';
import { Screen } from '../../src/components/Screen';
import { OrganizerProfile } from '../../src/features/organizer/profile/OrganizerProfile';
import { organizerProfileApi } from '../../src/features/organizer/profile/profile-api';
import { useSession } from '../../src/state/session';

/** Écran 26 : Profil Organisateur (NOISE-061). */
export default function Profile() {
  const user = useSession((s) => s.user);
  return (
    <Screen>
      <OrganizerProfile api={organizerProfileApi} user={user} onLogout={() => void logout()} />
    </Screen>
  );
}
