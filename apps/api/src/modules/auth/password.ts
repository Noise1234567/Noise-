import { hash, verify } from '@node-rs/argon2';

/**
 * Hachage des mots de passe en argon2id (docs/security.md).
 * Paramètres : recommandation OWASP (19 Mio de mémoire, 2 itérations, 1 fil).
 * L'algorithme par défaut de @node-rs/argon2 est argon2id ; il est vérifié par les tests.
 */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Vérifie un mot de passe. Si le compte n'existe pas (hash null), un hash factice est
 * quand même vérifié : la réponse prend le même temps, ce qui empêche de deviner
 * quels numéros ont un compte.
 */
export async function verifyPassword(passwordHash: string | null, password: string) {
  if (passwordHash === null) {
    dummyHash ??= hashPassword('mot-de-passe-factice');
    await verify(await dummyHash, password);
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // hash corrompu : jamais d'accès
  }
}
