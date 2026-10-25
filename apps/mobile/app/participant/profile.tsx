import { logout } from '../../src/auth/session-service';
import { Screen } from '../../src/components/Screen';
import { ParticipantProfile } from '../../src/features/participant/profile/ParticipantProfile';
import { useSession } from '../../src/state/session';

/** Écran 16 : Profil Participant (NOISE-062). */
export default function Profile() {
  const user = useSession((s) => s.user);
  return (
    <Screen>
      <ParticipantProfile user={user} onLogout={() => void logout()} />
    </Screen>
  );
}
