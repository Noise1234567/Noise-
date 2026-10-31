import { createPrismaClient } from '../lib/prisma.js';
import { CreateAdminError, createAdmin } from '../modules/admin/create-admin.js';

/**
 * Crée un compte administrateur (NOISE-055, docs/environments.md). Les valeurs viennent de
 * variables d'environnement passées au lancement, jamais d'un fichier versionné :
 *   ADMIN_NAME, ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD (12 caractères minimum), DATABASE_URL
 * Rien de secret n'est affiché : seul le numéro masqué l'est.
 */

const out = (message: string) => process.stdout.write(`${message}\n`);

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    out('DATABASE_URL manquante.');
    return 1;
  }
  const prisma = createPrismaClient(databaseUrl);
  try {
    const admin = await createAdmin(prisma, {
      name: process.env.ADMIN_NAME,
      phone: process.env.ADMIN_PHONE,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    out(`Compte administrateur créé : ${admin.phone} (${admin.id}).`);
    return 0;
  } catch (error) {
    out(error instanceof CreateAdminError ? error.message : 'Création impossible (voir la base).');
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().then((code) => {
  process.exitCode = code;
});
