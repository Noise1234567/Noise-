import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 ne charge plus .env automatiquement.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Non requis pour `prisma generate` (CI sans base) ; requis pour migrate / studio.
    url: process.env.DATABASE_URL ?? '',
  },
});
