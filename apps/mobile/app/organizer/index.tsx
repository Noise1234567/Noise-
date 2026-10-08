import { Greeting } from '../../src/components/Greeting';
import { RoleHeader } from '../../src/components/RoleHeader';
import { Screen } from '../../src/components/Screen';
import { StateView } from '../../src/components/StateView';

/** Écran 18 : Tableau de bord Organisateur. Vide tant qu'aucun événement n'existe (NOISE-018). */
export default function Dashboard() {
  return (
    <Screen>
      <RoleHeader />
      <Greeting />
      <StateView
        kind="empty"
        title="Aucun événement créé"
        message="Vos ventes et vos prochains événements apparaîtront ici."
      />
    </Screen>
  );
}
