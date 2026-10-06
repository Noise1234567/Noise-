import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-database.js';

/**
 * Avant les tests : applique les migrations à noise_test (`prisma migrate deploy`, sans
 * effacement). Le schéma de test reste ainsi toujours aligné sur les migrations.
 */
export default function setup() {
  if (!/\/noise_test(\?|$)/.test(TEST_DATABASE_URL)) {
    throw new Error(
      'TEST_DATABASE_URL doit pointer vers noise_test (voir apps/api/.env.example et pnpm db:up).',
    );
  }
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    });
  } catch (error) {
    const output = String((error as { stdout?: Buffer }).stdout ?? '');
    throw new Error(
      `Migrations impossibles sur noise_test. Si la base a une ancienne structure, la remettre à zéro (prisma migrate reset sur noise_test).\n${output}`,
      { cause: error },
    );
  }
}
