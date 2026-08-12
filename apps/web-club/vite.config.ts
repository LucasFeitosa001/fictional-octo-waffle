import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Beautypass Club — the customer-facing booking PWA. Installable, with web
// notifications enabled (the service worker is registered by vite-plugin-pwa
// and the app asks for Notification permission after login).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Temporarily self-destruct the service worker: older installs (from the
      // pre-migration belivin build) cache a stale bundle that calls a
      // cross-origin API and white-screens the page. A self-destroying SW
      // unregisters itself and clears all caches on next visit, recovering every
      // browser without manual DevTools steps. Re-enable the PWA once installs
      // have drained.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Salonpass — Agendamentos',
        short_name: 'Salonpass',
        description: 'Agende seu horário e acompanhe seus atendimentos.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#F2EADF',
        theme_color: '#111111',
        categories: ['lifestyle', 'business'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            options: { cacheName: 'api-no-cache' },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    // Aceita o host aleatório *.trycloudflare.com ao tunelar o dev (testar o
    // agendamento no mobile).
    allowedHosts: true,
    // API same-origin: o front chama window.location.origin/api/v1, que sobre o
    // túnel vira o host do túnel — proxiamos /api pro backend local (sem CORS,
    // cookie first-party). Removemos os headers sec-fetch-* senão o Better Auth
    // devolve 403 "Invalid origin" no login do cliente pelo túnel.
    proxy: {
      '/api': {
        target: 'http://localhost:3334',
        changeOrigin: false,
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
