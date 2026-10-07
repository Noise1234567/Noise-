import { defineConfig } from 'vite';

// En production, le build (dist/) est servi par l'API sous /scan (NOISE-026).
// En local, les appels /api sont redirigés vers l'API (pnpm dev:api).
export default defineConfig({
  base: '/scan/',
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: { target: 'es2020', sourcemap: true },
});
