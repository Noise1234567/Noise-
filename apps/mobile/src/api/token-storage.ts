import type { PublicUser } from '@noise/shared';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'noise.refreshToken';
const LAST_USER_KEY = 'noise.lastUser';

/** Le refresh token (30 jours) vit dans le stockage chiffré de l'appareil, jamais ailleurs. */
export const refreshTokenStorage = {
  get: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};

/**
 * Profil du dernier utilisateur connecté (NOISE-022). Au lancement sans réseau, il permet de
 * rouvrir la session pour afficher les billets enregistrés, au lieu de renvoyer à la connexion.
 * Données personnelles (nom, téléphone) : stockage chiffré, effacé à la déconnexion.
 */
export const lastUserStorage = {
  get: async (): Promise<PublicUser | null> => {
    try {
      const raw = await SecureStore.getItemAsync(LAST_USER_KEY);
      const user = raw ? (JSON.parse(raw) as Partial<PublicUser>) : null;
      return user && typeof user.id === 'string' && Array.isArray(user.roles)
        ? (user as PublicUser)
        : null;
    } catch {
      return null;
    }
  },
  set: (user: PublicUser) => SecureStore.setItemAsync(LAST_USER_KEY, JSON.stringify(user)),
  clear: () => SecureStore.deleteItemAsync(LAST_USER_KEY),
};

const ACTIVE_ROLE_KEY = 'noise.activeRole';

/**
 * Dernière vue utilisée (participant ou organisateur) par un compte qui a les deux rôles.
 * Stockée avec l'identifiant du compte : un autre compte sur le même appareil ne la reprend pas.
 */
export const activeRoleStorage = {
  get: async (userId: string): Promise<string | null> => {
    const value = await SecureStore.getItemAsync(ACTIVE_ROLE_KEY);
    const [owner, role] = value?.split(':') ?? [];
    return owner === userId && role ? role : null;
  },
  set: (userId: string, role: string) =>
    SecureStore.setItemAsync(ACTIVE_ROLE_KEY, `${userId}:${role}`),
  clear: () => SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY),
};

// L'access token (15 min) reste en mémoire : il disparaît à la fermeture de l'app, c'est voulu.
let accessToken: string | null = null;

export const accessTokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};
