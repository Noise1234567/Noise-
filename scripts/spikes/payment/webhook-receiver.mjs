// NOISE-010 — récepteur de webhooks jetable (hors src/), pour observer les webhooks sandbox.
// Usage depuis la racine : node scripts/spikes/payment/webhook-receiver.mjs
// Écoute sur http://localhost:4010 ; à exposer par un tunnel (cloudflared) et à déclarer
// dans le tableau de bord FedaPay sandbox (menu Webhooks).
// Si FEDAPAY_SANDBOX_WEBHOOK_SECRET est défini dans apps/api/.env, le script teste plusieurs
// formats de signature possibles et indique celui qui correspond. Aucun secret n'est affiché.
/* eslint-disable no-console -- script d'exploration : la sortie console est son but */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';

const ENV_PATH = 'apps/api/.env';
const PORT = 4010;

if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
const webhookSecret = process.env.FEDAPAY_SANDBOX_WEBHOOK_SECRET ?? '';

const hmacHex = (payload) => createHmac('sha256', webhookSecret).update(payload).digest('hex');

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Essaie les formats de signature plausibles et renvoie ceux qui correspondent. */
function checkSignature(header, rawBody) {
  if (!webhookSecret) return ['secret absent : vérification impossible'];
  if (!header) return ['en-tête de signature absent'];
  const matches = [];
  // Format 1 : HMAC hexadécimal du corps brut, éventuellement préfixé « sha256= ».
  const plain = header.replace(/^sha256=/, '');
  if (safeEqual(plain, hmacHex(rawBody))) matches.push('HMAC-SHA256 hex du corps brut');
  // Format 2 : « t=<horodatage>,s=<signature> », signature de « <t>.<corps brut> ».
  const parts = Object.fromEntries(header.split(',').map((part) => part.trim().split('=', 2)));
  if (parts.t && parts.s && safeEqual(parts.s, hmacHex(`${parts.t}.${rawBody}`))) {
    matches.push('t=<horodatage>,s=<HMAC hex de « t.corps brut »>');
  }
  return matches.length ? matches : ['aucun format testé ne correspond'];
}

createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const signature = req.headers['x-fedapay-signature'];
    console.log(`\n=== ${new Date().toISOString()} ${req.method} ${req.url}`);
    console.log('En-têtes reçus :', Object.keys(req.headers).join(', '));
    console.log(
      'Forme de X-FEDAPAY-SIGNATURE :',
      signature ? signature.replace(/[0-9a-f]{16,}/gi, '<hex>') : '(absent)',
    );
    console.log('Vérification :', checkSignature(signature, rawBody).join(' | '));
    try {
      const event = JSON.parse(rawBody);
      const entity = event.entity ?? event.data ?? {};
      console.log(
        `Événement : ${event.name ?? event.type ?? '?'} ; transaction ${entity.id ?? '?'} ; statut ${entity.status ?? '?'}`,
      );
    } catch {
      console.log('Corps non JSON (début) :', rawBody.slice(0, 200));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"received":true}');
  });
}).listen(PORT, () => {
  console.log(`Récepteur de webhooks sur http://localhost:${PORT}`);
  console.log(webhookSecret ? 'Secret de webhook chargé.' : 'Secret de webhook absent.');
});
