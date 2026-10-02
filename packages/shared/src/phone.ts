/**
 * Numéros de téléphone béninois. Depuis le 30 novembre 2024, les numéros mobiles ont
 * 10 chiffres et commencent par 01 ; l'ancien numéro à 8 chiffres devient « 01 » + ancien numéro.
 * Format de stockage : E.164 (+229 suivi des 10 chiffres). Le numéro est unique par compte.
 */

export const BENIN_COUNTRY_CODE = '229';

const LOCAL_NUMBER = /^01\d{8}$/;

/**
 * Normalise une saisie libre (espaces, tirets, +229, 00229, ancien format à 8 chiffres)
 * en E.164. Renvoie null si le numéro n'est pas un numéro béninois valide.
 */
export function normalizeBeninPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);

  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith(BENIN_COUNTRY_CODE) && digits.length >= 11) {
    digits = digits.slice(BENIN_COUNTRY_CODE.length);
  }
  if (digits.length === 8) digits = `01${digits}`;

  return LOCAL_NUMBER.test(digits) ? `+${BENIN_COUNTRY_CODE}${digits}` : null;
}

/** +2290166000001 → 0166000001 (format attendu par les opérateurs et FedaPay). */
export function toLocalBeninPhone(e164: string): string {
  return e164.startsWith(`+${BENIN_COUNTRY_CODE}`)
    ? e164.slice(BENIN_COUNTRY_CODE.length + 1)
    : e164;
}

/** Numéro masqué pour l'affichage et les journaux : +2290197****47. */
export function maskPhone(e164: string): string {
  return e164.length > 8 ? `${e164.slice(0, -6)}****${e164.slice(-2)}` : '****';
}
