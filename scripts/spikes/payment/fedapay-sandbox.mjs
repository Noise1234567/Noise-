// NOISE-010 — script d'exploration jetable (hors src/), sandbox FedaPay uniquement.
// Usage depuis la racine : node scripts/spikes/payment/fedapay-sandbox.mjs [mode] [numero]
//   mode   : momo_test (seul mode accepté en sandbox, défaut) ; mtn_open / moov renvoient 400
//   numero : numéro de test sandbox (défaut : 0166000001 → approved ; 0166000000 → declined)
// Les clés sont lues dans apps/api/.env et ne sont jamais affichées.
/* eslint-disable no-console -- script d'exploration : la sortie console est son but */

import { existsSync } from 'node:fs';

const ENV_PATH = 'apps/api/.env';
const BASE_URL = 'https://sandbox-api.fedapay.com/v1';
const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 3000;

if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const secretKey = process.env.FEDAPAY_SANDBOX_SECRET_KEY ?? '';
if (!secretKey.startsWith('sk_sandbox_')) {
  console.error('FEDAPAY_SANDBOX_SECRET_KEY absente ou pas une clé sandbox (apps/api/.env).');
  process.exit(1);
}

const mode = process.argv[2] ?? 'momo_test';
const phoneNumber = process.argv[3] ?? '0166000001';

/** Masque les champs sensibles avant affichage (jetons, numéros, e-mails). */
function redact(value) {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (typeof v !== 'string') return v;
      if (/token|secret|key|url/i.test(key)) return `${v.slice(0, 4)}…[masqué]`;
      if (/number|phone|email/i.test(key)) return `${v.slice(0, 2)}****${v.slice(-2)}`;
      return v;
    }),
  );
}

async function call(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  console.log(`\n${method} ${path} → HTTP ${res.status}`);
  console.log(JSON.stringify(redact(data), null, 2));
  if (!res.ok) throw new Error(`Échec ${method} ${path} (HTTP ${res.status})`);
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Création de la transaction (montant entier en XOF).
const created = await call('POST', '/transactions', {
  description: 'NOISE-010 test sandbox',
  amount: 100,
  currency: { iso: 'XOF' },
  customer: {
    firstname: 'Test',
    lastname: 'Noise',
    email: 'test@example.com',
    phone_number: { number: phoneNumber, country: 'bj' },
  },
});
const transaction = created['v1/transaction'] ?? created.transaction ?? created;
const transactionId = transaction.id;
console.log(`\nTransaction créée : id=${transactionId}, statut=${transaction.status}`);

// 2. Génération du token de paiement.
const tokenResponse = await call('POST', `/transactions/${transactionId}/token`);
const token = tokenResponse.token;

// 3. Paiement direct sans redirection.
await call('POST', `/${mode}`, {
  token,
  phone_number: { number: phoneNumber, country: 'bj' },
});

// 4. Revérification serveur du statut (le seul statut qui fait foi).
for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
  await sleep(POLL_DELAY_MS);
  const res = await fetch(`${BASE_URL}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  const current = data['v1/transaction'] ?? data.transaction ?? data;
  console.log(`Vérification ${attempt}/${POLL_ATTEMPTS} : statut=${current.status}`);
  if (current.status && current.status !== 'pending') break;
}
