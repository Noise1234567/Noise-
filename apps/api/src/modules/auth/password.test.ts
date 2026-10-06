import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('mots de passe', () => {
  it('hache en argon2id avec les paramètres OWASP, jamais en clair', async () => {
    const hashed = await hashPassword('motdepasse');
    expect(hashed).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hashed).not.toContain('motdepasse');
  });

  it('produit un hash différent à chaque fois (sel aléatoire)', async () => {
    expect(await hashPassword('motdepasse')).not.toBe(await hashPassword('motdepasse'));
  });

  it('vérifie le bon mot de passe et refuse un mauvais', async () => {
    const hashed = await hashPassword('motdepasse');
    expect(await verifyPassword(hashed, 'motdepasse')).toBe(true);
    expect(await verifyPassword(hashed, 'MotDePasse')).toBe(false);
  });

  it('refuse toujours quand le compte n’existe pas (hash null)', async () => {
    expect(await verifyPassword(null, 'motdepasse')).toBe(false);
  });

  it('refuse un hash corrompu sans lever d’erreur', async () => {
    expect(await verifyPassword('pas-un-hash', 'motdepasse')).toBe(false);
  });
});
