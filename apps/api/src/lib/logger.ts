import { pino } from 'pino';

/**
 * Logger unique. Les champs sensibles sont masqués : aucun mot de passe, token,
 * numéro de téléphone complet ou QR token ne doit apparaître dans les logs (docs/security.md).
 */
export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.qrToken',
        '*.phone',
        '*.email',
      ],
      censor: '[REDACTED]',
    },
  });
}
