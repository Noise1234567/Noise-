import { MAX_PHOTO_BYTES, checkPhoto } from './photo';

describe('checkPhoto', () => {
  it('accepte une photo JPEG et garde son nom', () => {
    expect(
      checkPhoto({
        uri: 'file:///a.jpg',
        mimeType: 'image/jpeg',
        fileName: 'cni.jpg',
        fileSize: 1000,
      }),
    ).toEqual({
      ok: true,
      photo: { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'cni.jpg' },
    });
  });

  it('sans type ni nom : JPEG et nom par défaut', () => {
    expect(checkPhoto({ uri: 'file:///a' })).toEqual({
      ok: true,
      photo: { uri: 'file:///a', mimeType: 'image/jpeg', fileName: 'piece.jpg' },
    });
  });

  it('PNG et WebP passent, avec la bonne extension par défaut', () => {
    expect(checkPhoto({ uri: 'u', mimeType: 'image/png' })).toMatchObject({
      ok: true,
      photo: { fileName: 'piece.png' },
    });
    expect(checkPhoto({ uri: 'u', mimeType: 'image/webp' })).toMatchObject({
      ok: true,
      photo: { fileName: 'piece.webp' },
    });
  });

  it('refuse un format autre que JPEG, PNG ou WebP (HEIC, PDF…)', () => {
    expect(checkPhoto({ uri: 'u', mimeType: 'image/heic' })).toEqual({
      ok: false,
      message: 'Format refusé : JPEG, PNG ou WebP uniquement.',
    });
  });

  it('refuse une photo de plus de 5 Mo, accepte exactement 5 Mo', () => {
    expect(checkPhoto({ uri: 'u', fileSize: MAX_PHOTO_BYTES + 1 })).toMatchObject({ ok: false });
    expect(checkPhoto({ uri: 'u', fileSize: MAX_PHOTO_BYTES })).toMatchObject({ ok: true });
  });
});
