import { describe, expect, it } from 'vitest';
import { buildPosterUrl, parseCloudinaryUrl } from './image-storage.js';

describe('parseCloudinaryUrl', () => {
  it('lit la clé, le secret et le nom du compte', () => {
    expect(parseCloudinaryUrl('cloudinary://123456:abc-def@noise-cloud')).toEqual({
      cloudName: 'noise-cloud',
      apiKey: '123456',
      apiSecret: 'abc-def',
    });
  });

  it.each(['https://123:abc@noise', 'cloudinary://noise', 'pas une url'])(
    'refuse une valeur invalide : %s',
    (value) => {
      expect(() => parseCloudinaryUrl(value)).toThrow();
    },
  );

  it('ne recopie pas le secret dans le message d’erreur', () => {
    expect(() => parseCloudinaryUrl('https://123:secret-tres-sensible@noise')).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret-tres-sensible') }),
    );
  });
});

describe('buildPosterUrl', () => {
  it('produit une URL HTTPS optimisée pour la 3G (largeur limitée, qualité et format auto)', () => {
    const url = buildPosterUrl('noise-cloud', 'noise/posters/event-1', 1790000000);
    expect(url).toBe(
      'https://res.cloudinary.com/noise-cloud/image/upload/c_limit,f_auto,q_auto,w_1080/v1790000000/noise/posters/event-1',
    );
  });
});
