import { DEFAULT_CITY, STYLE_FILTERS, dateLabel, dateOptions } from './filters';

describe('filtres de l’accueil', () => {
  it('propose Cotonou par défaut et les styles de la liste partagée', () => {
    expect(DEFAULT_CITY).toBe('Cotonou');
    expect(STYLE_FILTERS).toContain('Afrobeat');
    expect(STYLE_FILTERS).toContain('Concert');
    expect(STYLE_FILTERS).toContain('Soirée');
  });

  it('liste les jours en heure du Bénin : 23h30 UTC est déjà le lendemain', () => {
    const options = dateOptions(new Date('2026-10-17T23:30:00Z'), 3);
    expect(options.map((o) => o.value)).toEqual([
      undefined,
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ]);
    expect(options[1]?.label).toBe('Aujourd’hui · Dim. 18 oct.');
    expect(options[2]?.label).toBe('Demain · Lun. 19 oct.');
    expect(options[0]?.label).toBe('Toutes les dates');
  });

  it('affiche le jour choisi sans « Aujourd’hui » ni « Demain »', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    expect(dateLabel(undefined, now)).toBe('Toutes les dates');
    expect(dateLabel('2026-10-17', now)).toBe('Sam. 17 oct.');
    expect(dateLabel('2026-10-20', now)).toBe('Mar. 20 oct.');
  });
});
