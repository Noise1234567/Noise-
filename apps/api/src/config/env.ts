import { z } from 'zod';

/**
 * Variables d'environnement validées au démarrage : l'API refuse de démarrer
 * si une variable obligatoire manque ou est invalide (fail fast).
 * Ajouter ici chaque nouvelle variable ET dans .env.example.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url().optional(),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    // Paiement (NOISE-017, DEC-005). `fake` : FakeProvider, aucun appel réseau.
    PAYMENT_PROVIDER: z.enum(['fake', 'fedapay']).default('fake'),
    PAYMENT_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),
    PAYMENT_API_KEY: z.string().optional(),
    PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER === 'fake') {
      if (env.NODE_ENV === 'production') {
        ctx.addIssue({
          code: 'custom',
          path: ['PAYMENT_PROVIDER'],
          message: 'le FakeProvider est interdit en production',
        });
      }
      return;
    }
    if (!env.PAYMENT_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['PAYMENT_API_KEY'], message: 'obligatoire' });
    } else if (!env.PAYMENT_API_KEY.startsWith(`sk_${env.PAYMENT_ENVIRONMENT}_`)) {
      // Empêche d'utiliser une clé live en sandbox, ou l'inverse.
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_API_KEY'],
        message: `doit être une clé secrète sk_${env.PAYMENT_ENVIRONMENT}_`,
      });
    }
    if (!env.PAYMENT_WEBHOOK_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['PAYMENT_WEBHOOK_SECRET'], message: 'obligatoire' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuration invalide : ${issues}`);
  }
  return parsed.data;
}
