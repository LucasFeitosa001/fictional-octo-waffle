import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Cache-first pra assets estáticos, network-first pra API
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Salonpass Gestão',
        short_name: 'Salonpass',
        description: 'Gestão completa do seu salão',
        start_url: '/',
        display: 'standalone',
        background_color: '#fdfaf7',
        theme_color: '#f2b33d',
        orientation: 'any',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // Allow the random *.trycloudflare.com host when tunneling the dev server.
    allowedHosts: true,
    // Vite watcher: NÃO observar public/manifest.json nem outros assets
    // estáticos do public/. Uma edição neles disparava full-page reload no
    // dev (contribuindo pra sensação de "reload nuclear" no mobile quando
    // qualquer script tocasse no arquivo). HMR de código-fonte fica intacto.
    watch: {
      ignored: [
        '**/public/manifest.json',
        '**/public/brand/**',
        '**/public/favicon*',
        '**/public/apple-touch-icon*',
      ],
    },
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
