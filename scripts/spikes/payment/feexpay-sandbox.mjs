// NOISE-041 — script d'exploration jetable (hors src/) : paiement FeexPay en mode test.
// Usage depuis la racine : node scripts/spikes/payment/feexpay-sandbox.mjs [reseau] [numero]
//   reseau : mtn (défaut), moov ou celtiis_bj
//   numero : numéro à 10 chiffres (défaut : 0166000001), envoyé au format 229XXXXXXXXXX
// Les clés sont lues dans apps/api/.env et ne sont jamais affichées.
/* eslint-disable no-console -- script d'exploration : la sortie console est son but */

import { existsSync } from 'node:fs';

const ENV_PATH = 'apps/api/.env';
const BASE_URL = process.env.FEEXPAY_BASE_URL ?? 'https://api-v2.feexpay.me';
const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 5000;

if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
const apiKey = process.env.FEEXPAY_API_KEY ?? '';
const shopId = process.env.FEEXPAY_SHOP_ID ?? '';
if (!apiKey || !shopId) {
  console.error('FEEXPAY_API_KEY ou FEEXPAY_SHOP_ID absent (apps/api/.env).');
  process.exit(1);
}

const network = process.argv[2] ?? 'mtn';
const localNumber = process.argv[3] ?? '0166000001';
// « +46733123450 » : numéro de test de la sandbox MTN, envoyé tel quel (sans indicatif 229).
const phoneNumber = localNumber.startsWith('+') ? localNumber.slice(1) : `229${localNumber}`;

/** Masque tout ce qui ressemble à un secret, un jeton, un numéro ou un e-mail. */
function redact(value) {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (typeof v !== 'string') return v;
      if (v === apiKey || v === shopId) return '[masqué]';
      if (/token|secret|key|shop|url/i.test(key)) return '[masqué]';
      if (/phone|number|email/i.test(key)) return `${v.slice(0, 3)}****${v.slice(-2)}`;
      return v;
    }),
  );
}

async function call(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { brut: text.replaceAll(apiKey, '[masqué]').slice(0, 300) };
  }
  console.log(`\n${method} ${path.replace(shopId, '[shop]')} → HTTP ${res.status}`);
  console.log(JSON.stringify(redact(data), null, 2));
  return { status: res.status, data };
}

const reference = `noise041-${Date.now()}`;
const { data } = await call('POST', `/api/transactions/public/requesttopay/${network}`, {
  phoneNumber,
  amount: 100,
  shop: shopId,
  firstName: 'Ama',
  lastName: 'Test',
  description: 'NOISE 041 test',
  custom_id: reference,
  // Adresse de retour (tunnel vers webhook-receiver.mjs), si FeexPay l'accepte par requête.
  ...(process.env.FEEXPAY_CALLBACK_URL ? { callback_url: process.env.FEEXPAY_CALLBACK_URL } : {}),
});

const transactionRef = data?.reference ?? data?.data?.reference;
if (!transactionRef) {
  console.log('\nPas de référence de transaction dans la réponse : arrêt.');
  process.exit(0);
}

for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
  const { data: status } = await call(
    'GET',
    `/api/transactions/public/single/status/${encodeURIComponent(transactionRef)}`,
  );
  const value = status?.status ?? status?.data?.status;
  console.log(`Vérification ${attempt}/${POLL_ATTEMPTS} : statut=${value}`);
  if (value && value !== 'PENDING') break;
}
