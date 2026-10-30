import {
  splitSale,
  type CreatedScannerLinkDto,
  type EventDto,
  type ScannerLinkStatus,
} from '@noise/shared';

/**
 * Règles du détail d'un événement côté organisateur (NOISE-054), sans React : ventes par type
 * de billet, adresse du lien scanner à partager, libellés.
 */

export type SalesRow = { name: string; sold: number; total: number; netXof: number };

/**
 * Ventes par type de billet, d'après les champs réservés au propriétaire. Le montant net est
 * celui que l'organisateur reçoit après la commission de 10 % (DEC-024) ; c'est une estimation,
 * la commission réelle étant arrondie sur chaque commande.
 */
export function salesByType(event: Pick<EventDto, 'ticketTypes'>): {
  rows: SalesRow[];
  sold: number;
  total: number;
  netXof: number;
} {
  const rows = event.ticketTypes.map((type) => {
    const sold = type.quantitySold ?? 0;
    return {
      name: type.name,
      sold,
      total: type.quantityTotal ?? 0,
      netXof: splitSale(type.priceXof * sold, { withAffiliate: false }).organizerXof,
    };
  });
  return {
    rows,
    sold: rows.reduce((sum, r) => sum + r.sold, 0),
    total: rows.reduce((sum, r) => sum + r.total, 0),
    netXof: rows.reduce((sum, r) => sum + r.netXof, 0),
  };
}

/**
 * Adresse à envoyer au staff. Sans SCANNER_URL côté serveur, l'API renvoie `url: null` : le
 * scanner est servi par l'API elle-même sous /scan, on construit donc l'adresse à partir de
 * celle de l'API. Le jeton est après le « # » : il ne part jamais vers le serveur.
 */
export function scannerShareUrl(
  created: Pick<CreatedScannerLinkDto, 'url' | 'token'>,
  apiBaseUrl: string,
) {
  if (created.url) return created.url;
  const origin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  return `${origin}/scan/#${created.token}`;
}

/** Message envoyé par WhatsApp ou SMS au membre du staff. */
export function scannerShareMessage(eventTitle: string, url: string, label: string | null) {
  const who = label ? `${label}, voici` : 'Voici';
  return `${who} ton lien pour scanner les billets de « ${eventTitle} » à l'entrée. Ouvre-le sur ton téléphone, rien à installer : ${url}`;
}

/** Durées proposées ; sans durée, le lien vaut jusqu'à la fin de l'événement plus 2 heures. */
export const LINK_DURATIONS: { label: string; hours: number | undefined }[] = [
  { label: 'Jusqu’à la fin', hours: undefined },
  { label: '6 h', hours: 6 },
  { label: '12 h', hours: 12 },
  { label: '24 h', hours: 24 },
];

export const LINK_STATUS_LABELS: Record<ScannerLinkStatus, string> = {
  ACTIVE: 'Actif',
  EXPIRED: 'Expiré',
  REVOKED: 'Révoqué',
};

export const EVENT_STATUS_LABELS: Record<EventDto['status'], string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  CANCELLED: 'Annulé',
  SUSPENDED: 'Suspendu',
};

/** Un lien scanner ne peut être créé que pour un événement publié et pas encore terminé. */
export const canCreateScannerLink = (
  event: Pick<EventDto, 'status' | 'endsAt'>,
  now = new Date(),
) => event.status === 'PUBLISHED' && new Date(event.endsAt) > now;
