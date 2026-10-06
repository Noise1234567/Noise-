import { validateTicket } from './api';
import { createDuplicateFilter } from './duplicate-filter';
import { isExpired, readTokenFromHash } from './link-token';
import { createQrDetector, startCamera, type QrDetector } from './qr-reader';
import { describeFailure, describeScan, type Display } from './scan-messages';

/**
 * Scanner du staff (NOISE-026, docs/qr-scanner.md). Ouvert depuis le lien partagé par
 * l'organisateur : caméra → lecture du QR → validation par l'API → écran vert ou rouge.
 */

const RESULT_DURATION_MS = 2000;
const DETECTION_INTERVAL_MS = 150;
const TOKEN_STORAGE_KEY = 'noise-scanner-token';

const root = document.querySelector<HTMLElement>('#app');

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text; // jamais innerHTML : pas d'injection
  return node;
}

function showScreen(display: Display, action?: { label: string; onClick: () => void }) {
  if (!root) return;
  const screen = element('section', `screen screen--${display.tone}`);
  screen.setAttribute('role', 'alert');
  screen.append(element('h1', 'screen__title', display.title));
  if (display.detail) screen.append(element('p', 'screen__detail', display.detail));
  if (action) {
    const button = element('button', 'button', action.label);
    button.addEventListener('click', action.onClick);
    screen.append(button);
  }
  root.replaceChildren(screen);
}

/** Lit le jeton dans le lien, l'efface de la barre d'adresse et le garde pour la session. */
function loadToken(): string | null {
  const fromHash = readTokenFromHash(window.location.hash);
  try {
    if (fromHash) sessionStorage.setItem(TOKEN_STORAGE_KEY, fromHash);
    history.replaceState(null, '', window.location.pathname);
    return fromHash ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return fromHash; // stockage indisponible (navigation privée) : on garde le jeton en mémoire
  }
}

function vibrate(tone: Display['tone']) {
  navigator.vibrate?.(tone === 'success' ? 120 : [80, 60, 80]);
}

async function runScanner(token: string) {
  if (!root) return;
  const video = element('video', 'camera');
  const overlay = element('div', 'overlay');
  const hint = element('p', 'hint', 'Placez le QR code du billet devant la caméra');
  const stage = element('main', 'stage');
  stage.append(video, hint, overlay);
  root.replaceChildren(stage);

  let detect: QrDetector;
  try {
    await startCamera(video);
    detect = await createQrDetector();
  } catch {
    showScreen(
      {
        tone: 'error',
        title: 'Caméra inaccessible',
        detail: 'Autorisez l’accès à la caméra dans Chrome, puis réessayez.',
      },
      { label: 'Réessayer', onClick: () => void runScanner(token) },
    );
    return;
  }

  const isNew = createDuplicateFilter();
  let busy = false;

  const showResult = (display: Display) => {
    overlay.replaceChildren(element('p', 'overlay__title', display.title));
    if (display.detail) overlay.append(element('p', 'overlay__detail', display.detail));
    overlay.className = `overlay overlay--${display.tone} overlay--visible`;
    vibrate(display.tone);
  };

  const tick = async () => {
    if (!busy) {
      const code = await detect(video).catch(() => null);
      if (code && isNew(code)) {
        busy = true;
        showResult({ tone: 'warning', title: 'Vérification…' });
        const outcome = await validateTicket(code, token);
        if (outcome.kind === 'failure' && outcome.failure === 'unauthorized') {
          for (const track of (video.srcObject as MediaStream | null)?.getTracks() ?? []) {
            track.stop();
          }
          showScreen(describeFailure('unauthorized'));
          return; // lien inutilisable : on arrête le scanner
        }
        showResult(
          outcome.kind === 'scan'
            ? describeScan(outcome.response)
            : describeFailure(outcome.failure),
        );
        setTimeout(() => {
          overlay.className = 'overlay';
          busy = false;
        }, RESULT_DURATION_MS);
      }
    }
    setTimeout(() => void tick(), DETECTION_INTERVAL_MS);
  };
  void tick();
}

function start() {
  const token = loadToken();
  if (!token) {
    showScreen({
      tone: 'error',
      title: 'Lien invalide',
      detail: 'Ouvrez le lien scanner envoyé par l’organisateur.',
    });
    return;
  }
  if (isExpired(token)) {
    showScreen(describeFailure('unauthorized'));
    return;
  }
  showScreen(
    { tone: 'success', title: 'Scanner Noise', detail: 'Prêt à contrôler les entrées.' },
    { label: 'Démarrer le scanner', onClick: () => void runScanner(token) },
  );
}

start();
