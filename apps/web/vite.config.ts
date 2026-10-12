import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false } },
  },
  build: { sourcemap: true },
  // Each product's own address (from the server's settings), for links shown in Super Admin.
  define: {
    __APP_URLS__: JSON.stringify({ pos: process.env.APP_URL ?? '', gravity: process.env.GRAVITY_APP_URL ?? '', flow: process.env.FLOW_APP_URL ?? '' }),
  },
});
