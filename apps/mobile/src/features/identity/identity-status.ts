import type { MyIdentityResponse } from '@noise/shared';

import type { ApiError } from '../../api/errors';
import { formatDeadline } from '../participant/format';

export type IdentityTone = 'error' | 'warning' | 'info';

/** Ce que la carte de statut affiche pour une réponse de GET /me/identity (écrans organisateur). */
export type IdentityView = {
  tone: IdentityTone;
  title: string;
  message: string;
  /** Libellé du bouton ; absent quand il n'y a rien à faire. */
  action?: string;
};

/**
 * Les quatre états de la vérification (DEC-018). Un organisateur dont la pièce est envoyée peut
 * déjà créer et publier : seul un refus bloque, et ses événements restent en vente jusqu'à la
 * date limite.
 */
export function identityView(identity: MyIdentityResponse): IdentityView {
  switch (identity.status) {
    case 'NOT_SUBMITTED':
      return {
        tone: 'warning',
        title: 'Vérifiez votre identité',
        message: 'Envoyez une photo de votre pièce d’identité pour créer et publier vos soirées.',
        action: 'Envoyer ma pièce',
      };
    case 'PENDING':
      return {
        tone: 'warning',
        title: 'Pièce en cours de vérification',
        message:
          'Vous pouvez déjà créer et publier vos soirées. L’équipe Noise valide votre pièce.',
      };
    case 'VERIFIED':
      return {
        tone: 'info',
        title: 'Identité vérifiée',
        message: 'Votre pièce d’identité a été validée par l’équipe Noise.',
      };
    case 'REFUSED': {
      const reason = identity.refusalReason ? `Motif : ${identity.refusalReason}. ` : '';
      let consequence: string;
      if (identity.eventsPulled) {
        consequence =
          'Vos événements ont été retirés de la vente. Renvoyez une pièce pour les remettre en vente.';
      } else if (identity.resubmitDeadline) {
        consequence = `Renvoyez une pièce avant le ${formatDeadline(identity.resubmitDeadline)} pour garder vos événements en vente. D’ici là, vous ne pouvez ni créer ni publier.`;
      } else {
        consequence = 'Renvoyez une pièce pour pouvoir créer et publier vos soirées.';
      }
      return {
        tone: 'error',
        title: 'Pièce refusée',
        message: `${reason}${consequence}`,
        action: 'Renvoyer une pièce',
      };
    }
  }
}

/** La personne peut-elle envoyer une pièce ? Premier envoi ou nouvel envoi après un refus. */
export const canSubmitIdentity = (identity: MyIdentityResponse) =>
  identity.status === 'NOT_SUBMITTED' || identity.status === 'REFUSED';

/** Message d'erreur affiché sous le bouton d'envoi (bandeaux rouges des maquettes 3b–3d). */
export function submitErrorMessage(error: ApiError): string {
  if (error.isNetwork) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  if (error.status === 429) {
    const wait = error.retryAfterSeconds;
    return wait && wait > 0
      ? `Trop d’envois. Réessayez dans ${Math.ceil(wait / 60)} min.`
      : 'Trop d’envois. Réessayez un peu plus tard.';
  }
  // 400 (photo trop lourde, format refusé) et 409 (déjà envoyée) : le serveur explique déjà le problème.
  if (error.status === 400 || error.status === 409) return error.message;
  return 'Envoi impossible pour le moment. Réessayez.';
}
