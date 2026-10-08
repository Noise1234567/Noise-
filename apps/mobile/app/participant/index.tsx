import { Greeting } from '../../src/components/Greeting';
import { RoleHeader } from '../../src/components/RoleHeader';
import { Screen } from '../../src/components/Screen';
import { StateView } from '../../src/components/StateView';

/** Écran 6 : Accueil Événements. Vide tant que la liste des soirées n'existe pas (NOISE-014). */
export default function Home() {
  return (
    <Screen>
      <RoleHeader />
      <Greeting />
      <StateView
        kind="empty"
        title="Aucune soirée pour le moment"
        message="Les prochains événements de Cotonou apparaîtront ici."
      />
    </Screen>
  );
}
