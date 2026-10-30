import {
  MAX_TICKETS_PER_ORDER,
  initiatePaymentSchema,
  type MobileMoneyOperator,
  type OrderStatusResponse,
  type TicketTypeDto,
} from '@noise/shared';

import { formatLocalPhone, toApiPhone } from '../../../auth/forms';

/**
 * Règles du tunnel d'achat (NOISE-021), sans React : quantité, numéro de paiement, lecture du
 * statut renvoyé par le serveur et rythme des interrogations.
 */

/** Quantité maximale : 5 par commande (DEC-008), dans la limite des places disponibles. */
export const maxQuantity = (type: Pick<TicketTypeDto, 'available'>) =>
  Math.max(0, Math.min(MAX_TICKETS_PER_ORDER, type.available));

export const OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  MTN: 'MTN MoMo',
  MOOV: 'Moov Money',
};

/** « +2290197452138 » → « 01 97 45 21 38 », pour préremplir le numéro de paiement. */
export const localPhoneFromE164 = (phone: string | undefined) =>
  phone?.startsWith('+229') ? formatLocalPhone(phone.slice(4)) : '';

/** Message d'erreur du numéro, ou undefined s'il est valide (même schéma que l'API). */
export function validatePayerPhone(local: string): string | undefined {
  const parsed = initiatePaymentSchema.shape.phone.safeParse(toApiPhone(local));
  return parsed.success ? undefined : '10 chiffres, commençant par 01';
}

export type PaymentOutcome = 'waiting' | 'paid' | 'failed' | 'expired';

/**
 * Lecture du statut serveur. Une tentative refusée (solde insuffisant, demande ignorée) laisse
 * la commande PENDING : le participant peut réessayer tant que la réservation court.
 */
export function readPaymentOutcome(status: OrderStatusResponse): PaymentOutcome {
  switch (status.status) {
    case 'PAID':
      return 'paid';
    case 'EXPIRED':
    case 'FAILED':
    case 'CANCELLED':
      return 'expired';
    default:
      return status.payment?.status === 'FAILED' ? 'failed' : 'waiting';
  }
}

/** Interrogations du statut : 2 s au début, puis de plus en plus espacées jusqu'à 5 s (docs/api.md). */
const POLL_DELAYS_MS = [2000, 2000, 3000, 3000, 4000];
export const pollDelay = (attempt: number) => POLL_DELAYS_MS[attempt] ?? 5000;

/**
 * Clés d'idempotence (NOISE-053) : une clé par intention. Un nouvel essai de la même requête
 * (même contenu, après une erreur réseau) réutilise la clé ; un contenu différent en crée une
 * nouvelle ; après un succès ou une erreur définitive, `settle` l'oublie, pour que la prochaine
 * intention ait la sienne.
 */
export function createIntentKeys(random: () => string = randomKey) {
  let current: { signature: string; key: string } | null = null;
  return {
    keyFor(request: unknown): string {
      const signature = JSON.stringify(request);
      if (current?.signature !== signature) current = { signature, key: random() };
      return current.key;
    },
    settle() {
      current = null;
    },
  };
}

/**
 * Garder la clé seulement quand le résultat est inconnu (pas de réponse, 5xx). Une 4xx est
 * définitive : avec la même clé, le serveur rejouerait la même erreur pendant 24 h, même si
 * le stock est revenu entre-temps.
 */
export const keepsIntentKey = (status: number | null) => status === null || status >= 500;

/** 32 caractères aléatoires : unicité suffisante pour une intention d'achat (pas un secret). */
function randomKey(): string {
  let key = Date.now().toString(36);
  while (key.length < 32) key += Math.random().toString(36).slice(2);
  return key.slice(0, 32);
}

/** Secondes restantes avant la fin de la réservation (jamais négatif). */
export const secondsUntil = (iso: string, now: number = Date.now()) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
