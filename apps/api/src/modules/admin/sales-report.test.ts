import { splitSale } from '@noise/shared';
import { describe, expect, it } from 'vitest';
import { salesReportToCsv } from './sales-csv.js';
import { buildSalesReport, type PaidOrder } from './sales-report.js';

const order = (
  ticketTypeName: string,
  unitPriceXof: number,
  quantity: number,
  withAffiliate = false,
): PaidOrder => ({
  ticketTypeName,
  unitPriceXof,
  quantity,
  split: splitSale(unitPriceXof * quantity, { withAffiliate }),
});

describe('buildSalesReport', () => {
  const report = buildSalesReport('Soirée Cadjehoun', [
    order('VIP', 10_000, 2),
    order('Standard', 5_000, 3, true),
    order('VIP', 10_000, 1),
  ]);

  it('regroupe les ventes par type de billet (triés par nom)', () => {
    expect(report.lines).toEqual([
      { ticketTypeName: 'Standard', unitPriceXof: 5_000, ticketsSold: 3, grossXof: 15_000 },
      { ticketTypeName: 'VIP', unitPriceXof: 10_000, ticketsSold: 3, grossXof: 30_000 },
    ]);
  });

  it('additionne les parts du registre : Noise, partageurs, organisateur', () => {
    expect(report.totals).toEqual({
      ticketsSold: 6,
      grossXof: 45_000,
      noiseXof: 4_500,
      affiliateXof: 150, // 1 % de la commande Standard passée par un lien de partage
      organizerXof: 40_350,
    });
    const { grossXof, noiseXof, affiliateXof, organizerXof } = report.totals;
    expect(noiseXof + affiliateXof + organizerXof).toBe(grossXof);
  });

  it('sépare un type dont le prix a changé en cours de vente', () => {
    const changed = buildSalesReport('x', [order('Early', 3_000, 1), order('Early', 4_000, 1)]);
    expect(changed.lines.map((line) => line.unitPriceXof)).toEqual([3_000, 4_000]);
  });

  it('événement sans vente : totaux à zéro', () => {
    expect(buildSalesReport('x', []).totals.organizerXof).toBe(0);
  });

  it('refuse un registre incohérent plutôt que de reverser un montant faux', () => {
    const corrupted = { ...order('VIP', 10_000, 1), quantity: 2 };
    expect(() => buildSalesReport('x', [corrupted])).toThrow(/incohérent/);
    const badSplit = order('VIP', 10_000, 1);
    badSplit.split = { ...badSplit.split, organizerXof: badSplit.split.organizerXof + 1 };
    expect(() => buildSalesReport('x', [badSplit])).toThrow(/incohérent/);
  });
});

describe('salesReportToCsv', () => {
  const csv = salesReportToCsv(
    buildSalesReport('Soirée Cadjehoun', [order('VIP', 10_000, 2), order('Standard', 5_000, 1)]),
  );

  it('produit un CSV lisible par Excel en français (BOM, « ; », CRLF)', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      '﻿Événement;Soirée Cadjehoun',
      '',
      'Type de billet;Prix unitaire (FCFA);Billets vendus;Montant (FCFA)',
      'Standard;5000;1;5000',
      'VIP;10000;2;20000',
      '',
      'Total des ventes;;3;25000',
      'Commission Noise (10 %);;;2500',
      'Commission des partageurs (1 %);;;0',
      'Net à reverser à l’organisateur;;;22500',
      '',
    ]);
  });

  it('échappe les « ; » et guillemets saisis par l’organisateur', () => {
    const tricky = salesReportToCsv(buildSalesReport('Soirée "Afro; Vibes"', []));
    expect(tricky).toContain('Événement;"Soirée ""Afro; Vibes"""');
  });

  it.each(['=HYPERLINK("http://pirate")', '+33 VIP', '-1', '@SUM(A1)'])(
    'neutralise une formule Excel saisie comme nom de billet : %s',
    (name) => {
      const injected = salesReportToCsv(buildSalesReport('x', [order(name, 1_000, 1)]));
      const line = injected.split('\r\n').find((l) => l.includes('1000;1;1000')) ?? '';
      expect(line.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );
});
