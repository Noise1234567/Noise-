import { describe, expect, it } from 'vitest';
import { detectPosterFormat } from './poster-file.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);

describe('detectPosterFormat', () => {
  it.each([
    ['jpeg', JPEG],
    ['png', PNG],
    ['webp', WEBP],
  ])('reconnaît %s à ses premiers octets', (format, file) => {
    expect(detectPosterFormat(file)).toBe(format);
  });

  it.each([
    ['texte', Buffer.from('ceci est un texte renommé en .jpg')],
    ['GIF', Buffer.from('GIF89a')],
    ['PDF', Buffer.from('%PDF-1.7')],
    [
      'RIFF non WebP (WAV)',
      Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]),
    ],
    ['fichier vide', Buffer.alloc(0)],
  ])('refuse : %s', (_label, file) => {
    expect(detectPosterFormat(file)).toBeNull();
  });
});
