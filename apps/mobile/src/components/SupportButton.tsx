import { Linking } from 'react-native';

import { Button } from './Button';
import { SUPPORT_EMAIL, supportMailUrl } from './support';

type Props = {
  /** Référence du dossier, ajoutée au sujet et au message (ex. « commande 3f2a… »). */
  reference?: string;
  /** Adresse du support ; par défaut celle de la configuration (injectée pour les tests). */
  email?: string;
};

/** « Contacter le support » : ouvre l'application mail du téléphone (NOISE-057). */
export function SupportButton({ reference, email = SUPPORT_EMAIL }: Props) {
  if (!email) return null;
  return (
    <Button
      variant="text"
      label="Contacter le support"
      onPress={() => void Linking.openURL(supportMailUrl(email, reference)).catch(() => undefined)}
    />
  );
}
