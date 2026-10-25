import type { MyIdentityResponse } from '@noise/shared';

import { displayPhone, identitySummary, toForm, validateContactForm } from './profile-rules';

const identity = (over: Partial<MyIdentityResponse>): MyIdentityResponse => ({
  status: 'NOT_SUBMITTED',
  canOrganize: false,
  submittedAt: null,
  refusalReason: null,
  resubmitDeadline: null,
  eventsPulled: false,
  ...over,
});

describe('profil organisateur : règles', () => {
  it('numéro au format local et formulaire de départ', () => {
    expect(displayPhone('+2290197454547')).toBe('01 97 45 45 47');
    expect(displayPhone(null)).toBe('');
    expect(
      toForm({ whatsapp: '+2290197454547', instagram: 'https://x', facebook: null, tiktok: null }),
    ).toEqual({ whatsapp: '01 97 45 45 47', instagram: 'https://x', facebook: '', tiktok: '' });
  });

  it('validation du schéma partagé : erreurs par champ, vides effacés', () => {
    expect(
      validateContactForm({
        whatsapp: '01 97 45 45 47',
        instagram: '@kofi',
        facebook: '',
        tiktok: ' ',
      }),
    ).toEqual({
      errors: {},
      input: { whatsapp: '+2290197454547', instagram: '@kofi', facebook: null, tiktok: null },
    });
    expect(
      validateContactForm({
        whatsapp: '12',
        instagram: 'https://evil.example/x',
        facebook: '',
        tiktok: '',
      }).errors,
    ).toEqual({
      whatsapp: 'Numéro WhatsApp béninois invalide',
      instagram: 'Lien Instagram invalide',
    });
  });

  it('état de la pièce d’identité', () => {
    expect(identitySummary(identity({})).label).toBe('Non envoyée');
    expect(identitySummary(identity({ status: 'PENDING' })).label).toBe('En cours de vérification');
    expect(identitySummary(identity({ status: 'VERIFIED' })).label).toBe('Vérifiée');
    expect(
      identitySummary(identity({ status: 'REFUSED', refusalReason: 'Photo floue' })).detail,
    ).toBe('Motif : Photo floue. Envoyez une nouvelle pièce.');
  });
});
