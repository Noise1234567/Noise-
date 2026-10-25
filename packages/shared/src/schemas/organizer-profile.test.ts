import { describe, expect, it } from 'vitest';
import { normalizeSocialLink, updateOrganizerProfileSchema } from './organizer-profile.js';

describe('normalizeSocialLink', () => {
  it('accepte un lien complet, sans https:// ou un nom d’utilisateur seul', () => {
    expect(normalizeSocialLink('instagram', 'https://www.instagram.com/kofi.events/')).toBe(
      'https://www.instagram.com/kofi.events/',
    );
    expect(normalizeSocialLink('instagram', 'instagram.com/kofi.events')).toBe(
      'https://instagram.com/kofi.events',
    );
    expect(normalizeSocialLink('instagram', '@kofi.events')).toBe(
      'https://www.instagram.com/kofi.events',
    );
    expect(normalizeSocialLink('tiktok', '@kofi_events')).toBe(
      'https://www.tiktok.com/@kofi_events',
    );
    expect(normalizeSocialLink('facebook', 'http://m.facebook.com/kofi.events')).toBe(
      'https://m.facebook.com/kofi.events',
    );
  });

  it('refuse un autre site, un lien sans profil ou un faux domaine', () => {
    expect(normalizeSocialLink('instagram', 'https://evil.example.com/kofi')).toBeNull();
    expect(normalizeSocialLink('instagram', 'https://www.facebook.com/kofi')).toBeNull();
    expect(normalizeSocialLink('facebook', 'https://facebook.com/')).toBeNull();
    expect(normalizeSocialLink('tiktok', 'https://tiktok.com.evil.example/x')).toBeNull();
    expect(normalizeSocialLink('instagram', 'https://user:pass@instagram.com/kofi')).toBeNull();
    expect(normalizeSocialLink('instagram', 'javascript:alert(1)')).toBeNull();
  });
});

describe('updateOrganizerProfileSchema', () => {
  it('normalise le WhatsApp et les liens ; vide ou absent devient null', () => {
    expect(
      updateOrganizerProfileSchema.parse({
        whatsapp: '01 97 45 45 47',
        instagram: '@kofi',
        facebook: '',
      }),
    ).toEqual({
      whatsapp: '+2290197454547',
      instagram: 'https://www.instagram.com/kofi',
      facebook: null,
      tiktok: null,
    });
  });

  it('message par champ invalide', () => {
    const result = updateOrganizerProfileSchema.safeParse({
      whatsapp: '123',
      tiktok: 'https://example.com/x',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ['whatsapp', 'Numéro WhatsApp béninois invalide'],
      ['tiktok', 'Lien TikTok invalide'],
    ]);
  });
});
