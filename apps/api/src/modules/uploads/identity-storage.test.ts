import { describe, expect, it } from 'vitest';
import { CloudinaryIdentityStorage, FakeIdentityStorage } from './identity-storage.js';

describe('CloudinaryIdentityStorage.signedUrl', () => {
  const storage = new CloudinaryIdentityStorage(
    'cloudinary://123456:secret-tres-sensible@noise-cloud',
  );
  const expiresAt = new Date('2026-10-17T10:05:00Z');

  it('produit un lien signé qui expire, sans jamais contenir le secret', () => {
    const url = new URL(
      storage.signedUrl({ publicId: 'noise/identity/u1', format: 'jpg' }, expiresAt),
    );
    expect(url.hostname).toBe('api.cloudinary.com');
    expect(url.pathname).toContain('/noise-cloud/');
    expect(url.searchParams.get('public_id')).toBe('noise/identity/u1');
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(url.searchParams.get('expires_at')).toBe(String(Math.floor(expiresAt.getTime() / 1000)));
    expect(url.searchParams.get('api_key')).toBe('123456');
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{40,64}$/);
    expect(url.toString()).not.toContain('secret-tres-sensible');
  });

  it('change de signature quand l’expiration change (le lien ne peut pas être prolongé)', () => {
    const doc = { publicId: 'noise/identity/u1', format: 'jpg' };
    const a = new URL(storage.signedUrl(doc, expiresAt)).searchParams.get('signature');
    const b = new URL(
      storage.signedUrl(doc, new Date(expiresAt.getTime() + 60_000)),
    ).searchParams.get('signature');
    expect(a).not.toBe(b);
  });
});

describe('FakeIdentityStorage', () => {
  it('stocke, signe et supprime', async () => {
    const storage = new FakeIdentityStorage();
    const doc = await storage.upload(Buffer.from('x'), { userId: 'u1' });
    expect(storage.files.has(doc.publicId)).toBe(true);
    await storage.delete(doc.publicId);
    expect(storage.files.size).toBe(0);
  });
});
