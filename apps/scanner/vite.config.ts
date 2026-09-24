import { defineConfig } from 'vite';

// En production, le build (dist/) est servi par l'API sous /scan (NOISE-026).
export default defineConfig({
  base: '/scan/',
  server: { port: 5173 },
  build: { target: 'es2020', sourcemap: true },
});
