import { Linking } from 'react-native';

import { Button } from './Button';
import { SUPPORT_WHATSAPP, supportWhatsAppUrl } from './support';

type Props = {
  /** Référence du dossier, ajoutée au message (ex. « commande 3f2a… »). */
  reference?: string;
  /** Numéro du support ; par défaut celui de la configuration (injecté pour les tests). */
  number?: string;
};

/** « Contacter le support » : ouvre WhatsApp (NOISE-057). Rien n'est affiché sans numéro. */
export function SupportButton({ reference, number = SUPPORT_WHATSAPP }: Props) {
  if (!number) return null;
  return (
    <Button
      variant="text"
      label="Contacter le support"
      onPress={() =>
        void Linking.openURL(supportWhatsAppUrl(number, reference)).catch(() => undefined)
      }
    />
  );
}
