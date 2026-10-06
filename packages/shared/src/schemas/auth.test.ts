import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.js';

const valid = {
  name: 'Aminata Sossou',
  phone: '01 97 45 45 47',
  password: 'motdepasse',
  role: 'PARTICIPANT',
};

describe('registerSchema', () => {
  it('accepte une inscription valide et normalise le numéro', () => {
    expect(registerSchema.parse(valid)).toEqual({ ...valid, phone: '+2290197454547' });
  });

  it.each([
    ['nom trop court', { name: 'A' }],
    ['numéro invalide', { phone: '12345' }],
    ['mot de passe trop court', { password: 'court' }],
    ['mot de passe trop long', { password: 'x'.repeat(129) }],
    ['rôle ADMIN refusé', { role: 'ADMIN' }],
  ])('refuse : %s', (_label, override) => {
    expect(registerSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('retire les espaces autour du nom', () => {
    expect(registerSchema.parse({ ...valid, name: '  Kofi  ' }).name).toBe('Kofi');
  });
});

describe('loginSchema', () => {
  it('normalise le numéro et accepte un mot de passe court (message générique)', () => {
    expect(loginSchema.parse({ phone: '97454547', password: 'x' })).toEqual({
      phone: '+2290197454547',
      password: 'x',
    });
  });
});
