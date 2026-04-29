FROM node:22-bookworm-slim AS build

WORKDIR /app/telegram-bot

COPY telegram-bot/package.json ./package.json

RUN npm install

COPY telegram-bot/ ./

RUN npm run build && npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app/telegram-bot

COPY --from=build /app/telegram-bot/package.json ./package.json
COPY --from=build /app/telegram-bot/node_modules ./node_modules
COPY --from=build /app/telegram-bot/dist ./dist

EXPOSE 3010

CMD ["node", "dist/index.js"]

