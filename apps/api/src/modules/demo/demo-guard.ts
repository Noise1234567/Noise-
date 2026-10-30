/**
 * Garde-fous du seed de démonstration (NOISE-058) : il ne tourne jamais en production, ni sur
 * une base qui n'est pas explicitement une base de développement ou de staging.
 */

export const DEMO_DEFAULT_PASSWORD = 'motdepasse';
export const DEMO_PASSWORD_MIN_LENGTH = 8;

export interface DemoSeedPlan {
  databaseName: 'noise_dev' | 'noise_staging';
  /** Compte administrateur de développement : noise_dev uniquement. */
  withAdmin: boolean;
  password: string;
}

export class DemoSeedRefused extends Error {}

/** Nom de la base dans l'URL de connexion (dernier segment du chemin), ou null. */
export function databaseNameOf(databaseUrl: string): string | null {
  try {
    const name = new URL(databaseUrl).pathname.replace(/^\//, '');
    return name === '' ? null : name;
  } catch {
    return null;
  }
}

/**
 * Décide si le seed peut tourner et avec quels réglages. Refuse (DemoSeedRefused) :
 * NODE_ENV=production, une base autre que noise_dev / noise_staging, et au staging l'absence de
 * DEMO_PASSWORD (les comptes de démo y sont joignables depuis Internet : mot de passe choisi,
 * jamais celui par défaut).
 */
export function planDemoSeed(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DEMO_PASSWORD?: string;
}): DemoSeedPlan {
  if (env.NODE_ENV === 'production') {
    throw new DemoSeedRefused('Seed refusé : jamais de données de démonstration en production.');
  }
  const name = env.DATABASE_URL ? databaseNameOf(env.DATABASE_URL) : null;
  if (name !== 'noise_dev' && name !== 'noise_staging') {
    throw new DemoSeedRefused(
      'Seed refusé : DATABASE_URL doit pointer vers noise_dev ou noise_staging.',
    );
  }
  const password = env.DEMO_PASSWORD?.trim() ? env.DEMO_PASSWORD : undefined;
  if (password !== undefined && password.length < DEMO_PASSWORD_MIN_LENGTH) {
    throw new DemoSeedRefused(
      `Seed refusé : DEMO_PASSWORD doit faire au moins ${DEMO_PASSWORD_MIN_LENGTH} caractères.`,
    );
  }
  if (name === 'noise_staging') {
    if (password === undefined) {
      throw new DemoSeedRefused(
        'Seed refusé : au staging, DEMO_PASSWORD est obligatoire (mot de passe commun des comptes de démo).',
      );
    }
    return { databaseName: name, withAdmin: false, password };
  }
  return { databaseName: name, withAdmin: true, password: password ?? DEMO_DEFAULT_PASSWORD };
}
