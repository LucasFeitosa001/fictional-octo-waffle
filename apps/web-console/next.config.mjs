import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Console de suporte da SalonPass — admin.salonpass.com.br. Ver estudo 135.
 *
 * Site estático, como os outros frontends do repositório: `next build` emite
 * `out/`, servido por S3 + CloudFront. O console fala direto com a API pelo
 * NEXT_PUBLIC_API_URL.
 *
 * O cookie de sessão funciona nesse arranjo porque `admin.salonpass.com.br` e
 * `api.salonpass.com.br` são o MESMO site (mesmo domínio registrável), então o
 * `SameSite=Lax` do cookie não barra a chamada. E ele é host-only: quem o
 * recebe é só a API, nunca `app.` nem `agenda.`.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: join(__dirname, '../..'),
};

export default nextConfig;
