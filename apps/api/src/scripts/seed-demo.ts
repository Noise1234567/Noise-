import { createPrismaClient } from '../lib/prisma.js';
import { DemoSeedRefused, planDemoSeed } from '../modules/demo/demo-guard.js';
import { seedDemo } from '../modules/demo/demo-seed.js';
import { hashPassword } from '../modules/auth/password.js';

/**
 * Données de démonstration (NOISE-058, docs/environments.md section 6).
 * Variables : DATABASE_URL (noise_dev ou noise_staging), QR_SIGNING_SECRET (celui de
 * l'environnement : les QR des billets de démo sont alors valides pour cette API),
 * DEMO_PASSWORD (obligatoire au staging ; « motdepasse » par défaut en local).
 * Jamais en production. Aucun mot de passe n'est affiché.
 */

const out = (message: string) => process.stdout.write(`${message}\n`);

async function main(): Promise<number> {
  try {
    const plan = planDemoSeed(process.env);
    const qrSigningSecret = process.env.QR_SIGNING_SECRET;
    if (!qrSigningSecret || qrSigningSecret.length < 32) {
      out('QR_SIGNING_SECRET manquante (32 caractères minimum) : elle signe les QR des billets.');
      return 1;
    }
    const prisma = createPrismaClient(process.env.DATABASE_URL as string);
    try {
      const summary = await seedDemo({
        prisma,
        qrSigningSecret,
        passwordHash: await hashPassword(plan.password),
        withAdmin: plan.withAdmin,
      });
      out(`Données de démo créées sur ${plan.databaseName} :`);
      out(
        `${summary.users} comptes, ${summary.events} événements, ${summary.ticketTypes} types de billets, ${summary.orders} commandes, ${summary.tickets} billets, ${summary.scans} scans.`,
      );
      out('Comptes (même mot de passe pour tous) :');
      for (const account of summary.accounts) {
        out(`  ${account.phone}  ${account.name}  [${account.role}]`);
      }
      return 0;
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    if (error instanceof DemoSeedRefused) {
      out(error.message);
    } else {
      out('Seed impossible (voir l’erreur ci-dessous).');
      process.stderr.write(`${String(error)}\n`);
    }
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});
