import { emailSchema, maskPhone, phoneSchema } from '@noise/shared';
import { z } from 'zod';
import type { PrismaClient } from '../../lib/prisma.js';
import { hashPassword } from '../auth/password.js';

/**
 * Création d'un compte administrateur (NOISE-055). L'inscription publique ne crée jamais de
 * compte ADMIN : ce compte se crée à la main, en staging et en production, par ce script.
 * Le compte peut voir les pièces d'identité (NOISE-048) : mot de passe de 12 caractères minimum.
 */

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export const createAdminSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  phone: phoneSchema,
  email: emailSchema,
  password: z
    .string()
    .min(ADMIN_PASSWORD_MIN_LENGTH, `Au moins ${ADMIN_PASSWORD_MIN_LENGTH} caractères`)
    .max(128, 'Mot de passe trop long'),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export class CreateAdminError extends Error {}

/** Crée le compte ; refuse un numéro ou un e-mail déjà utilisé. Ne renvoie aucun secret. */
export async function createAdmin(
  prisma: PrismaClient,
  raw: unknown,
): Promise<{ id: string; phone: string }> {
  const parsed = createAdminSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`);
    throw new CreateAdminError(`Données invalides (${details.join(' ; ')})`);
  }
  const input = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone: input.phone }, { email: input.email }] },
    select: { id: true },
  });
  if (existing) throw new CreateAdminError('Ce numéro ou cet e-mail a déjà un compte');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roles: ['ADMIN'],
    },
    select: { id: true, phone: true },
  });
  return { id: user.id, phone: maskPhone(user.phone) };
}
