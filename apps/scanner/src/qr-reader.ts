/**
 * Lecture des QR depuis la caméra arrière. BarcodeDetector (natif, rapide) est utilisé
 * quand le navigateur le propose (Chrome Android) ; sinon jsQR décode les images.
 */

/** Largeur d'analyse pour jsQR : suffisante pour un QR à 20 cm, légère pour un milieu de gamme. */
const ANALYSIS_WIDTH = 480;

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options: { formats: string[] }): NativeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

export type QrDetector = (video: HTMLVideoElement) => Promise<string | null>;

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  return stream;
}

export async function createQrDetector(): Promise<QrDetector> {
  const Native = window.BarcodeDetector;
  if (
    Native &&
    (await Native.getSupportedFormats().catch((): string[] => [])).includes('qr_code')
  ) {
    const detector = new Native({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }

  // Chargé seulement si nécessaire : sur Chrome Android, jsQR n'est jamais téléchargé (3G).
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!context || video.videoWidth === 0) return null;
    const scale = Math.min(1, ANALYSIS_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null
    );
  };
}
