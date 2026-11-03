import { displayPhone, toForm, validateContactForm } from './profile-rules';

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
});
