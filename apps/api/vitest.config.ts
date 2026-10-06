import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// TEST_DATABASE_URL est lu dans .env en local ; en CI, DATABASE_URL pointe déjà vers noise_test.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/db/global-setup.ts'],
    // Les tests d'intégration partagent la base noise_test : fichiers exécutés en séquence.
    fileParallelism: false,
  },
});
