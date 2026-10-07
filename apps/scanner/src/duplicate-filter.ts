/**
 * La caméra lit le même QR plusieurs fois par seconde : un code identique n'est envoyé
 * qu'une fois par fenêtre de 3 secondes (docs/qr-scanner.md, section 4). Un autre code
 * passe immédiatement.
 */
export const DUPLICATE_WINDOW_MS = 3000;

export function createDuplicateFilter(windowMs = DUPLICATE_WINDOW_MS) {
  let last: { code: string; at: number } | null = null;
  return (code: string, now = Date.now()): boolean => {
    if (last && last.code === code && now - last.at < windowMs) return false;
    last = { code, at: now };
    return true;
  };
}
