import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Allow the random *.trycloudflare.com host when tunneling the dev server.
    allowedHosts: true,
    // Same-origin API: the frontend calls window.location.origin/api/v1, which
    // over a tunnel resolves to the tunnel host. Proxy /api to the local API so
    // there's no CORS and the session cookie is first-party (mirrors prod).
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: false,
      },
    },
  },
});
