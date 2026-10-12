import { scanValidateResponseSchema, type ScanValidateResponse } from '@noise/shared';
import type { ScanFailure } from './scan-messages';

/** Au-delà, le staff voit « Pas de connexion » plutôt qu'un écran figé (3G). */
export const REQUEST_TIMEOUT_MS = 8000;
export const VALIDATE_PATH = '/api/v1/scanner/validate';

export type ValidateOutcome =
  { kind: 'scan'; response: ScanValidateResponse } | { kind: 'failure'; failure: ScanFailure };

/**
 * Envoie le QR lu à l'API. La validation est toujours faite par le serveur (DEC-014) :
 * aucune décision n'est prise localement.
 */
export async function validateTicket(
  qrCode: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<ValidateOutcome> {
  let response: Response;
  try {
    response = await fetchFn(VALIDATE_PATH, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCode }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'failure', failure: 'network' };
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: 'failure', failure: 'unauthorized' };
  }
  if (response.status === 429) return { kind: 'failure', failure: 'rate_limited' };
  if (!response.ok) return { kind: 'failure', failure: 'server' };

  const parsed = scanValidateResponseSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? { kind: 'scan', response: parsed.data }
    : { kind: 'failure', failure: 'server' };
}
