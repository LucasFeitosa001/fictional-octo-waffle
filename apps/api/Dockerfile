# Beautypass API — production image (NestJS + Prisma + Better Auth)
# Build context = repo root:  docker build -f apps/api/Dockerfile -t beautypass-api .
FROM node:20-slim

# openssl + ca-certificates are required by the Prisma query engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

WORKDIR /app

# Copy the whole monorepo (node_modules/dist are excluded via .dockerignore).
COPY . .

# Install only the API and its workspace deps (@beautypass/db, @beautypass/shared);
# skips the heavy web/mobile dependency trees. Keeps devDeps for the build.
RUN pnpm install --frozen-lockfile --filter "@beautypass/api..."

# Generate Prisma client (engine matches this image's debian/openssl) and build.
RUN pnpm --filter @beautypass/db generate \
  && pnpm --filter @beautypass/shared build \
  && pnpm --filter @beautypass/db build \
  && pnpm --filter @beautypass/api build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/api/dist/main.js"]
