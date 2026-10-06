import { expect, test, type Page } from '@playwright/test';
import QRCode from 'qrcode';

const QR_CONTENT = 'NOISE1.ticket-1.aleatoire.signature';
const VALIDATE = '**/api/v1/scanner/validate';

const base64Url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const linkToken = (exp: number) =>
  `${base64Url({ alg: 'HS256' })}.${base64Url({ eventId: 'event-1', exp })}.signature`;
const VALID_TOKEN = linkToken(Math.floor(Date.now() / 1000) + 3600);

/**
 * Remplace la caméra par un canvas qui affiche le QR (décodé par jsQR, comme sur un
 * navigateur sans BarcodeDetector), ou simule un refus d'accès.
 */
async function fakeCamera(page: Page, mode: 'qr' | 'denied' = 'qr') {
  const qrDataUrl = await QRCode.toDataURL(QR_CONTENT, { width: 300, margin: 2 });
  await page.addInitScript(
    ({ dataUrl, denied }) => {
      delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
      navigator.mediaDevices.getUserMedia = async () => {
        if (denied) throw new DOMException('Refusé', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext('2d') as CanvasRenderingContext2D;
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const draw = () => {
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 170, 90, 300, 300);
          requestAnimationFrame(draw);
        };
        draw();
        return canvas.captureStream(15);
      };
    },
    { dataUrl: qrDataUrl, denied: mode === 'denied' },
  );
}

async function openAndStart(page: Page, token = VALID_TOKEN) {
  await page.goto(`/scan/#${token}`);
  await page.getByRole('button', { name: 'Démarrer le scanner' }).click();
}

test('billet valide : écran vert avec le nom, requête authentifiée par le jeton du lien', async ({
  page,
}) => {
  await fakeCamera(page);
  const requests: { auth?: string; body: unknown }[] = [];
  await page.route(VALIDATE, async (route) => {
    requests.push({
      auth: route.request().headers().authorization,
      body: route.request().postDataJSON(),
    });
    await route.fulfill({
      json: { result: 'ACCEPTED', holderName: 'Aminata Sossou', ticketTypeName: 'VIP' },
    });
  });

  await openAndStart(page);

  await expect(page.getByText('Entrée validée')).toBeVisible();
  await expect(page.getByText('Aminata Sossou · VIP')).toBeVisible();
  expect(requests[0]).toEqual({ auth: `Bearer ${VALID_TOKEN}`, body: { qrCode: QR_CONTENT } });
});

test('le jeton disparaît de la barre d’adresse après ouverture', async ({ page }) => {
  await fakeCamera(page);
  await page.goto(`/scan/#${VALID_TOKEN}`);
  await expect(page.getByRole('button', { name: 'Démarrer le scanner' })).toBeVisible();
  expect(page.url()).not.toContain(VALID_TOKEN);
});

test('un même QR resté devant la caméra n’est envoyé qu’une fois par fenêtre de 3 s', async ({
  page,
}) => {
  await fakeCamera(page);
  let calls = 0;
  await page.route(VALIDATE, async (route) => {
    calls += 1;
    await route.fulfill({ json: { result: 'ACCEPTED' } });
  });

  await openAndStart(page);
  await expect(page.getByText('Entrée validée')).toBeVisible();
  await page.waitForTimeout(2500); // résultat affiché 2 s, le QR reste devant la caméra
  expect(calls).toBe(1);
});

test.describe('refus', () => {
  for (const [response, message] of [
    [{ result: 'ALREADY_USED', usedAt: '2026-10-21T20:30:00Z' }, 'Billet déjà utilisé à 21:30'],
    [{ result: 'INVALID' }, 'Billet invalide'],
    [{ result: 'CANCELLED' }, 'Billet annulé'],
    [{ result: 'WRONG_EVENT' }, 'Billet d’un autre événement'],
  ] as const) {
    test(`${response.result} : écran rouge « ${message} »`, async ({ page }) => {
      await fakeCamera(page);
      await page.route(VALIDATE, (route) => route.fulfill({ json: response }));
      await openAndStart(page);
      await expect(page.getByText(message)).toBeVisible();
    });
  }
});

test('lien révoqué (401) : le scanner s’arrête et demande un nouveau lien', async ({ page }) => {
  await fakeCamera(page);
  await page.route(VALIDATE, (route) => route.fulfill({ status: 401, json: {} }));
  await openAndStart(page);
  await expect(page.getByText('Lien expiré ou révoqué')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
});

test('perte de réseau : écran orange « Pas de connexion », aucune validation locale', async ({
  page,
}) => {
  await fakeCamera(page);
  await page.route(VALIDATE, (route) => route.abort('internetdisconnected'));
  await openAndStart(page);
  await expect(page.getByText('Pas de connexion')).toBeVisible();
});

test('lien expiré : message dès l’ouverture, sans démarrer la caméra', async ({ page }) => {
  await fakeCamera(page);
  await page.goto(`/scan/#${linkToken(Math.floor(Date.now() / 1000) - 60)}`);
  await expect(page.getByText('Lien expiré ou révoqué')).toBeVisible();
});

test('lien sans jeton : message « Lien invalide »', async ({ page }) => {
  await page.goto('/scan/');
  await expect(page.getByText('Lien invalide')).toBeVisible();
});

test('caméra refusée : message et bouton pour réessayer', async ({ page }) => {
  await fakeCamera(page, 'denied');
  await openAndStart(page);
  await expect(page.getByText('Caméra inaccessible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});
