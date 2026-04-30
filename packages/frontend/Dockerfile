FROM node:22-bookworm-slim AS build

WORKDIR /app

# Build shared first (frontend depends on built dist/types)
COPY shared ./shared

WORKDIR /app/shared
RUN npm ci && npm run build && npm prune --omit=dev

# Install frontend dependencies (includes file:../shared with dist already built)
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/

WORKDIR /app/frontend
RUN npm ci

# Copy frontend sources and build
WORKDIR /app
COPY frontend ./frontend

WORKDIR /app/frontend
RUN npm run build && npm prune --omit=dev


FROM caddy:2.8-alpine AS runtime

WORKDIR /srv

COPY --from=build /app/frontend/dist ./ 
COPY frontend/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

