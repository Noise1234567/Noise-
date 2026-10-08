import { PASSWORD_MIN_LENGTH, loginSchema, passwordSchema, registerSchema } from '@noise/shared';

/** Validation des formulaires : mêmes schémas Zod que l'API (CLAUDE.md section 6). */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const PHONE_HINT = '10 chiffres, commençant par 01';

/** Chiffres saisis, mis en forme « 01 97 45 21 38 » au fil de la frappe. */
export function formatLocalPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ');
}

/** Valeur envoyée à l'API : l'indicatif est fixe, l'API normalise en E.164. */
export const toApiPhone = (local: string): string => `+229${local.replace(/\D/g, '')}`;

export const passwordHint = `${PASSWORD_MIN_LENGTH} caractères minimum`;

export type SignupValues = { name: string; phone: string; password: string };
export type SignupField = keyof SignupValues;

export function validateSignup(values: SignupValues): FieldErrors<SignupField> {
  const errors: FieldErrors<SignupField> = {};
  const name = registerSchema.shape.name.safeParse(values.name);
  if (!name.success) errors.name = 'Entrez votre nom complet (2 caractères minimum)';
  if (!registerSchema.shape.phone.safeParse(toApiPhone(values.phone)).success)
    errors.phone = PHONE_HINT;
  const password = passwordSchema.safeParse(values.password);
  if (!password.success)
    errors.password = values.password.length > 128 ? 'Mot de passe trop long' : passwordHint;
  return errors;
}

export type LoginValues = { phone: string; password: string };
export type LoginField = keyof LoginValues;

export function validateLogin(values: LoginValues): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {};
  const parsed = loginSchema.safeParse({
    phone: toApiPhone(values.phone),
    password: values.password,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'phone') errors.phone = PHONE_HINT;
      if (key === 'password') errors.password = 'Entrez votre mot de passe';
    }
  }
  return errors;
}
