FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install dependencies (including workspace file dependency: ../shared)
COPY shared/package.json ./shared/package.json
COPY backend/package.json backend/package-lock.json ./backend/

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

COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]

