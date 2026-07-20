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
        target: 'http://localhost:3334',
        changeOrigin: false,
        // 🚨 CRÍTICO: Better Auth retorna 403 "Invalid origin" quando sec-fetch-site=same-origin
        // bate com origin do túnel Cloudflare. Removemos esses headers antes do proxy forward.
        // NÃO REMOVER — se sumir, login pelo túnel volta a dar Invalid origin.
        configure: (proxy) => {
          proxy.on('proxyReq', (pr) => {
            pr.removeHeader('sec-fetch-site');
            pr.removeHeader('sec-fetch-mode');
            pr.removeHeader('sec-fetch-dest');
          });
        },
      },
    },
  },
});
