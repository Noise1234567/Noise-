import { useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Placeholder } from '../../src/components/Placeholder';

/** Écran 4 : Connexion. Le formulaire arrive dans la PR suivante (NOISE-008, étape 3). */
export default function Login() {
  const router = useRouter();
  return (
    <Placeholder title="Bon retour" note="Connectez-vous avec votre numéro. Formulaire à venir.">
      <Button
        variant="text"
        label="Pas de compte ? Créer un compte"
        onPress={() => router.replace('/signup')}
      />
    </Placeholder>
  );
}
