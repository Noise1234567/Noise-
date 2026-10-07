import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout du scanner (NOISE-026) : vrai navigateur au format téléphone
 * Android, fausse caméra qui affiche un QR, API simulée. Aucun appel réseau réel.
 */
const PORT = 4174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chrome-android', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/scan/`,
    reuseExistingServer: true,
  },
});
