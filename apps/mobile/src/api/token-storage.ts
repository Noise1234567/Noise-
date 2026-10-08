import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'noise.refreshToken';

/** Le refresh token (30 jours) vit dans le stockage chiffré de l'appareil, jamais ailleurs. */
export const refreshTokenStorage = {
  get: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};

// L'access token (15 min) reste en mémoire : il disparaît à la fermeture de l'app, c'est voulu.
let accessToken: string | null = null;

export const accessTokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};
