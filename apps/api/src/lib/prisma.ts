import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Client Prisma (NOISE-006). Prisma 7 se connecte à PostgreSQL via l'adaptateur `pg`.
 * Un seul client par processus : il gère son propre pool de connexions.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export type { PrismaClient };
