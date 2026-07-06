import type { MetadataRoute } from 'next';

// Served at `<basePath>/manifest.webmanifest`. Paths must include the basePath so
// the installed app scopes to `/admin` in production (and `/` in dev/e2e).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Salonpass Gestão',
    short_name: 'Salonpass',
    description: 'Painel da salão: agenda, profissionais, serviços e clientes.',
    lang: 'pt-BR',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#060606',
    theme_color: '#060606',
    icons: [
      { src: `${base}/salonpass-mark.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: `${base}/salonpass-mark.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
