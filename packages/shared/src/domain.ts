/**
 * Vocabulaire métier commun à l'API, à l'app mobile et au scanner.
 * Source : cahier des charges v1.0 + décisions DEC-0xx (voir decisions.md).
 * Toute modification ici est un changement de contrat : PR relue par les deux développeurs.
 */

export const CURRENCY = 'XOF' as const;

/** Durée de vie d'une commande non payée (CDC 4.2 étape 3). */
export const ORDER_EXPIRATION_MINUTES = 15;

/** Nombre maximum de billets par commande (DEC-008). */
export const MAX_TICKETS_PER_ORDER = 5;

export const USER_ROLES = ['PARTICIPANT', 'ORGANIZER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * PENDING : créée, stock réservé, en attente de paiement (15 min max).
 * PAID : paiement confirmé et revérifié côté fournisseur.
 * EXPIRED / FAILED : stock libéré.
 * CANCELLED : événement annulé après paiement (remboursement manuel, DEC-010).
 */
export const ORDER_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MOBILE_MONEY_OPERATORS = ['MTN', 'MOOV'] as const;
export type MobileMoneyOperator = (typeof MOBILE_MONEY_OPERATORS)[number];

/** VALID : présentable. USED : scanné une fois. CANCELLED : invalidé (événement annulé, fraude). */
export const TICKET_STATUSES = ['VALID', 'USED', 'CANCELLED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Résultats possibles d'un scan, affichés par le scanner (vert / rouge). */
export const SCAN_RESULTS = [
  'ACCEPTED',
  'ALREADY_USED',
  'INVALID',
  'CANCELLED',
  'WRONG_EVENT',
] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];
