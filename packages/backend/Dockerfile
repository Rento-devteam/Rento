FROM node:22-bookworm-slim AS build

WORKDIR /app

# Prisma needs OpenSSL in slim images
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Required for `prisma generate` during `npm ci` (postinstall)
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"

# Install dependencies (including workspace file dependency: ../shared)
COPY shared/package.json ./shared/package.json
COPY backend/package.json backend/package-lock.json ./backend/
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY backend/scripts/ensure-prisma-client.cjs ./backend/scripts/ensure-prisma-client.cjs

WORKDIR /app/backend
RUN npm ci

# Copy sources
WORKDIR /app
COPY shared ./shared
COPY backend ./backend

WORKDIR /app/backend
RUN npm run build && npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app/backend

# Prisma CLI (migrate deploy) needs OpenSSL in runtime too
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main.js"]

