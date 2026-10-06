import type { ScanValidateResponse } from '@noise/shared';

/** Textes affichés au staff (docs/qr-scanner.md, section 4). */

export type Tone = 'success' | 'error' | 'warning';

export interface Display {
  tone: Tone;
  title: string;
  detail?: string;
}

export type ScanFailure = 'unauthorized' | 'network' | 'rate_limited' | 'server';

/** Heure de Cotonou (UTC+1), quel que soit le fuseau du téléphone. */
function cotonouTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Porto-Novo',
  }).format(date);
}

const ticketLine = (response: ScanValidateResponse) =>
  [response.holderName, response.ticketTypeName].filter(Boolean).join(' · ') || undefined;

export function describeScan(response: ScanValidateResponse): Display {
  switch (response.result) {
    case 'ACCEPTED':
      return { tone: 'success', title: 'Entrée validée', detail: ticketLine(response) };
    case 'ALREADY_USED': {
      const time = response.usedAt ? cotonouTime(response.usedAt) : null;
      return {
        tone: 'error',
        title: time ? `Billet déjà utilisé à ${time}` : 'Billet déjà utilisé',
        detail: ticketLine(response),
      };
    }
    case 'CANCELLED':
      return { tone: 'error', title: 'Billet annulé' };
    case 'WRONG_EVENT':
      return { tone: 'error', title: 'Billet d’un autre événement' };
    case 'INVALID':
      return { tone: 'error', title: 'Billet invalide' };
  }
}

export function describeFailure(failure: ScanFailure): Display {
  switch (failure) {
    case 'network':
      return { tone: 'warning', title: 'Pas de connexion', detail: 'Réessayez dans un instant.' };
    case 'rate_limited':
      return { tone: 'warning', title: 'Trop de scans', detail: 'Patientez quelques secondes.' };
    case 'server':
      return { tone: 'warning', title: 'Erreur du serveur', detail: 'Réessayez.' };
    case 'unauthorized':
      return {
        tone: 'error',
        title: 'Lien expiré ou révoqué',
        detail: 'Demandez un nouveau lien à l’organisateur.',
      };
  }
}
