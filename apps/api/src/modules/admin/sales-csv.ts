import { AFFILIATE_COMMISSION_BPS, NOISE_COMMISSION_BPS } from '@noise/shared';
import type { SalesReport } from './sales-report.js';

/**
 * Export CSV du rapport des ventes, pensé pour Excel en français : séparateur « ; »,
 * UTF-8 avec BOM (accents corrects), fins de ligne CRLF, montants en FCFA entiers.
 */

const SEPARATOR = ';';
const BOM = '﻿';

const percent = (bps: number) => `${(bps / 100).toLocaleString('fr-FR')} %`;

/**
 * Échappe une cellule. Une valeur saisie par un organisateur (titre, nom de billet) qui
 * commence par = + - @ serait exécutée comme une formule par Excel (injection CSV) :
 * elle est préfixée d'une apostrophe.
 */
function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (...values: (string | number)[]) => values.map(cell).join(SEPARATOR);

export function salesReportToCsv(
  report: SalesReport,
  rates = { noiseBps: NOISE_COMMISSION_BPS, affiliateBps: AFFILIATE_COMMISSION_BPS },
): string {
  const { totals } = report;
  const rows = [
    row('Événement', report.eventTitle),
    '',
    row('Type de billet', 'Prix unitaire (FCFA)', 'Billets vendus', 'Montant (FCFA)'),
    ...report.lines.map((line) =>
      row(line.ticketTypeName, line.unitPriceXof, line.ticketsSold, line.grossXof),
    ),
    '',
    row('Total des ventes', '', totals.ticketsSold, totals.grossXof),
    row(`Commission Noise (${percent(rates.noiseBps)})`, '', '', totals.noiseXof),
    row(`Commission des partageurs (${percent(rates.affiliateBps)})`, '', '', totals.affiliateXof),
    row('Net à reverser à l’organisateur', '', '', totals.organizerXof),
  ];
  return BOM + rows.join('\r\n') + '\r\n';
}
