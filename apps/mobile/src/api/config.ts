/** URL de l'API. Variable publique (embarquée dans l'APK) : jamais de secret ici. */
const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

export const API_BASE_URL = `${base.replace(/\/$/, '')}/api/v1`;
