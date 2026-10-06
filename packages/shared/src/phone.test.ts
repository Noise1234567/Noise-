import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeBeninPhone, toLocalBeninPhone } from './phone.js';

describe('normalizeBeninPhone', () => {
  it.each([
    ['0197454547', '+2290197454547'],
    ['01 97 45 45 47', '+2290197454547'],
    ['01-97-45-45-47', '+2290197454547'],
    ['+229 01 97 45 45 47', '+2290197454547'],
    ['+2290197454547', '+2290197454547'],
    ['002290197454547', '+2290197454547'],
    ['2290197454547', '+2290197454547'],
    // Ancien format à 8 chiffres : « 01 » est ajouté devant.
    ['97454547', '+2290197454547'],
    ['+229 97 45 45 47', '+2290197454547'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBeninPhone(input)).toBe(expected);
  });

  it.each([
    '',
    'abc',
    '0297454547', // ne commence pas par 01
    '019745454', // 9 chiffres
    '019745454712', // 12 chiffres
    '+33612345678', // autre pays
    '01974545a7',
  ])('refuse %s', (input) => {
    expect(normalizeBeninPhone(input)).toBeNull();
  });
});

describe('formats dérivés', () => {
  it('convertit en numéro local à 10 chiffres', () => {
    expect(toLocalBeninPhone('+2290166000001')).toBe('0166000001');
  });

  it('masque le numéro (jamais en clair dans les journaux)', () => {
    expect(maskPhone('+2290197454547')).toBe('+2290197****47');
  });
});
