import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    // Les tests d'intégration base de données (à partir de NOISE-006) partagent une base :
    // exécution séquentielle des fichiers pour éviter les interférences.
    fileParallelism: false,
  },
});
