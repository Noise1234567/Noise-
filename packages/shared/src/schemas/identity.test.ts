import { describe, expect, it } from 'vitest';
import { adminIdentityListQuerySchema, refuseIdentityBodySchema } from './identity.js';

describe('refuseIdentityBodySchema', () => {
  it('exige un motif de 5 à 500 caractères, nettoyé des espaces', () => {
    expect(refuseIdentityBodySchema.parse({ reason: '  Photo illisible  ' })).toEqual({
      reason: 'Photo illisible',
      immediate: false,
    });
    expect(refuseIdentityBodySchema.safeParse({}).success).toBe(false);
    expect(refuseIdentityBodySchema.safeParse({ reason: ' abc ' }).success).toBe(false);
    expect(refuseIdentityBodySchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
  });

  it('accepte le refus immédiat uniquement comme booléen', () => {
    expect(
      refuseIdentityBodySchema.parse({ reason: 'Fraude évidente', immediate: true }).immediate,
    ).toBe(true);
    expect(
      refuseIdentityBodySchema.safeParse({ reason: 'Fraude évidente', immediate: 'oui' }).success,
    ).toBe(false);
  });
});

describe('adminIdentityListQuerySchema', () => {
  it('liste les demandes en attente par défaut, 20 par page', () => {
    expect(adminIdentityListQuerySchema.parse({})).toEqual({ status: 'PENDING', limit: 20 });
  });

  it('refuse un statut inconnu et une page de plus de 50', () => {
    expect(adminIdentityListQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(adminIdentityListQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
});
