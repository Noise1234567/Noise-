/**
 * Jeton du lien scanner : https://<api>/scan/#<jwt> (docs/qr-scanner.md, section 2).
 * Il est placé après le « # » : le navigateur ne l'envoie jamais au serveur et il
 * n'apparaît pas dans les journaux. Le scanner ne vérifie pas sa signature (c'est le rôle
 * de l'API) ; il lit seulement sa date d'expiration pour prévenir le staff.
 */

const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

export function readTokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim();
  return JWT_SHAPE.test(token) ? token : null;
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
}

/** Expiration du jeton en millisecondes, ou null si illisible. */
export function readExpiry(token: string): number | null {
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(token.split('.')[1] ?? ''));
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string, now = Date.now()): boolean {
  const expiry = readExpiry(token);
  return expiry !== null && expiry <= now;
}
