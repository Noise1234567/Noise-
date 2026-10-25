import { hasContact, socialEntries, whatsappUrl } from './organizer-contact';

const none = { whatsapp: null, instagram: null, facebook: null, tiktok: null };

describe('contacts de l’organisateur', () => {
  it('lien WhatsApp : chiffres seuls et message encodé', () => {
    expect(whatsappUrl('+2290197454547', 'Afro Night')).toBe(
      `https://wa.me/2290197454547?text=${encodeURIComponent('Bonjour, je vous contacte au sujet de « Afro Night » vu sur Noise.')}`,
    );
  });

  it('seulement les réseaux renseignés, dans un ordre fixe', () => {
    expect(
      socialEntries({ ...none, tiktok: 'https://www.tiktok.com/@k', instagram: 'https://i/k' }),
    ).toEqual([
      { key: 'instagram', label: 'Instagram', url: 'https://i/k' },
      { key: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@k' },
    ]);
    expect(hasContact(none)).toBe(false);
    expect(hasContact({ ...none, whatsapp: '+2290197454547' })).toBe(true);
  });
});
