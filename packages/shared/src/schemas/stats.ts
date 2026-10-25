/**
 * Statistiques d'un événement pour son organisateur (NOISE-027, docs/api.md section 4).
 * Montants en FCFA entiers (DEC-022). Les parts viennent du registre des commandes : rien
 * n'est recalculé par le mobile.
 */

export interface TicketTypeStatsDto {
  ticketTypeId: string;
  name: string;
  priceXof: number;
  quantityTotal: number;
  /** Billets payés (commandes PAID). */
  sold: number;
  /** Places encore disponibles à la vente. */
  remaining: number;
  grossXof: number;
}

/** Entrées sur une tranche d'une heure (début de l'heure, ISO 8601 UTC). */
export interface ArrivalBucketDto {
  hourStart: string;
  count: number;
}

export interface EventStatsDto {
  eventId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'SUSPENDED';
  /** Heure du calcul : le mobile affiche « mis à jour à… ». */
  generatedAt: string;
  sales: {
    ticketsSold: number;
    /** Total payé par les participants, hors frais de l'agrégateur. */
    grossXof: number;
    /** Part de l'organisateur après la commission de Noise (DEC-009, DEC-022). */
    organizerNetXof: number;
    /** Commission de Noise. */
    noiseFeeXof: number;
  };
  byType: TicketTypeStatsDto[];
  entries: {
    /** Billets déjà scannés à l'entrée. */
    checkedIn: number;
    /** Billets valides qui n'ont pas encore servi. */
    notYetEntered: number;
    cancelled: number;
    /** Dernière entrée enregistrée, ou null si personne n'est encore entré. */
    lastEntryAt: string | null;
    /** Scans refusés (billet déjà utilisé, invalide, annulé, autre événement). */
    refusedScans: number;
    alreadyUsedScans: number;
    /** Entrées par heure, de la première à la dernière, heures vides comprises. */
    arrivals: ArrivalBucketDto[];
  };
}
