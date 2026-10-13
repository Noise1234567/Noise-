import type { AuthSession, LoginInput, PublicUser, RegisterInput } from '@noise/shared';
import type { User } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from './password.js';
import { createAccessToken, generateRefreshToken, hashRefreshToken } from './tokens.js';

/**
 * Règles de l'authentification (NOISE-007, CDC 5.3, docs/security.md). Ce service ne
 * connaît pas Express : les routes valident les entrées, le service applique les règles.
 */

const INVALID_CREDENTIALS = 'Numéro ou mot de passe incorrect';
const SESSION_EXPIRED = 'Session expirée, reconnectez-vous';

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  email: user.email,
  roles: user.roles,
});

/** Erreur Prisma « valeur déjà utilisée » (contrainte d'unicité). */
const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly accessTokenSecret: string,
  ) {}

  async register(input: RegisterInput): Promise<AuthSession> {
    const passwordHash = await hashPassword(input.password);
    // Vérification explicite pour dire quel champ pose problème ; la contrainte d'unicité de la
    // base reste le garde-fou si deux inscriptions identiques arrivent en même temps.
    const emailTaken = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) {
      throw new HttpError(409, 'CONFLICT', 'Un compte existe déjà avec cette adresse e-mail');
    }
    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          passwordHash,
          roles: [input.role],
        },
      });
      return await this.openSession(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'CONFLICT', 'Un compte existe déjà avec ce numéro');
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    // Vérification même si le compte n'existe pas : même temps de réponse (password.ts).
    const valid = await verifyPassword(user?.passwordHash ?? null, input.password);
    if (!user || !valid) throw new HttpError(401, 'UNAUTHENTICATED', INVALID_CREDENTIALS);
    if (user.status !== 'ACTIVE') throw new HttpError(403, 'FORBIDDEN', 'Compte suspendu');
    return this.openSession(user);
  }

  /**
   * Rotation : le refresh token présenté est révoqué et remplacé. S'il avait déjà été
   * utilisé (vol probable), toute la chaîne de l'utilisateur est révoquée (docs/security.md).
   */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      include: { user: true },
    });
    if (!stored) throw new HttpError(401, 'UNAUTHENTICATED', SESSION_EXPIRED);
    if (stored.revokedAt) {
      await this.revokeAllSessions(stored.userId, now);
      throw new HttpError(401, 'UNAUTHENTICATED', SESSION_EXPIRED);
    }
    if (stored.expiresAt <= now || stored.user.status !== 'ACTIVE') {
      throw new HttpError(401, 'UNAUTHENTICATED', SESSION_EXPIRED);
    }

    const next = generateRefreshToken(now);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Révocation conditionnelle : si deux requêtes présentent le même jeton en même temps,
      // une seule le révoque ; l'autre est traitée comme une réutilisation.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) return false;
      const created = await tx.refreshToken.create({
        data: { userId: stored.userId, tokenHash: next.tokenHash, expiresAt: next.expiresAt },
      });
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: created.id },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeAllSessions(stored.userId, now);
      throw new HttpError(401, 'UNAUTHENTICATED', SESSION_EXPIRED);
    }

    return {
      accessToken: await this.accessTokenFor(stored.user),
      refreshToken: next.token,
      user: toPublicUser(stored.user),
    };
  }

  /** Révoque le refresh token de cet appareil. Sans effet s'il l'était déjà. */
  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'Compte introuvable');
    return toPublicUser(user);
  }

  /**
   * Active le second rôle (participant ou organisateur, CDC 3.1). Renvoie un nouvel access
   * token, puisque les rôles y sont inscrits ; le refresh token ne change pas.
   */
  async activateRole(
    userId: string,
    role: 'PARTICIPANT' | 'ORGANIZER',
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new HttpError(404, 'NOT_FOUND', 'Compte introuvable');
    const user = current.roles.includes(role)
      ? current
      : await this.prisma.user.update({
          where: { id: userId },
          data: { roles: { push: role } },
        });
    return { accessToken: await this.accessTokenFor(user), user: toPublicUser(user) };
  }

  private async openSession(user: User): Promise<AuthSession> {
    const { token, tokenHash, expiresAt } = generateRefreshToken();
    await this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    return {
      accessToken: await this.accessTokenFor(user),
      refreshToken: token,
      user: toPublicUser(user),
    };
  }

  private accessTokenFor(user: User) {
    return createAccessToken({ userId: user.id, roles: user.roles }, this.accessTokenSecret);
  }

  private async revokeAllSessions(userId: string, now: Date) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
