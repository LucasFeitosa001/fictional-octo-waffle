import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production this app is served under a sub-path (e.g. `/admin`) of the same
// CloudFront domain as web-club, so Better Auth cookies stay first-party. Driven
// by NEXT_PUBLIC_BASE_PATH so dev/e2e keep serving at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fully static site served from S3 + CloudFront. `next build` emits `out/`.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
  // The shared/brand packages are TS source consumed directly from the workspace.
  transpilePackages: ['@salonpass/shared', '@salonpass/brand'],
  // Pin the file-tracing root to the monorepo so a stray lockfile in $HOME
  // doesn't get picked as the workspace root.
  outputFileTracingRoot: join(__dirname, '../..'),
};

export default nextConfig;
