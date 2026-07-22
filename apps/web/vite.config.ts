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
      // ÚNICA fonte do manifest — o plugin gera /manifest.webmanifest e injeta
      // o <link rel="manifest">. Não existe mais public/manifest.json estático
      // (dois manifests conflitavam e a barra do browser ficava indefinida).
      manifest: {
        id: '/',
        name: 'Salonpass Gestão',
        short_name: 'Salonpass',
        description: 'Gestão completa do seu salão de beleza — agenda, comandas, financeiro e clientes.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#111111',
        theme_color: '#f2b33d',
        orientation: 'portrait',
        categories: ['business', 'productivity', 'lifestyle'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Maskable como entrada SEPARADA (não "any maskable" no mesmo item —
          // o Android recorta o ícone com safe-zone só quando é 'maskable' puro).
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Agenda', short_name: 'Agenda', url: '/agenda', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Comandas', short_name: 'Comandas', url: '/comandas', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Clientes', short_name: 'Clientes', url: '/clientes', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
        ],
        screenshots: [
          { src: '/screenshot-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Painel no desktop' },
          { src: '/screenshot-narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'App no celular' },
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
