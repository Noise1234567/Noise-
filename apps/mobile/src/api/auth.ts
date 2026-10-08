import type { AuthSession, LoginInput, RegisterInput } from '@noise/shared';
import type { AxiosInstance } from 'axios';

/** Appels /auth. Les erreurs sortent en ApiError (voir client.ts). */
export function createAuthApi(client: AxiosInstance) {
  return {
    register: async (input: RegisterInput) =>
      (await client.post<AuthSession>('/auth/register', input, { skipAuthRefresh: true })).data,
    login: async (input: LoginInput) =>
      (await client.post<AuthSession>('/auth/login', input, { skipAuthRefresh: true })).data,
    logout: async (refreshToken: string) => {
      await client.post('/auth/logout', { refreshToken }, { skipAuthRefresh: true });
    },
  };
}
