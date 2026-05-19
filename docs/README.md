# Документация Rento (репозиторий)

Диаграммы в `docs/` синхронизированы с **фактической логикой** в `packages/backend` (Prisma + NestJS) по состоянию репозитория. Если расхождение с [openAPI.yaml](openAPI.yaml) — приоритет у контроллеров `packages/backend/src/**/*.controller.ts`.

## Легенда статусов (sequence / state)

| Метка             | Значение                                                         |
| ----------------- | ---------------------------------------------------------------- |
| **Реализовано**   | Есть рабочий код и HTTP-маршруты                                 |
| **Частично**      | Базовый сценарий есть, детали из ТЗ (чат, handover, споры) — нет |
| **Запланировано** | Описано в ТЗ / OpenAPI, в коде отсутствует                       |

## Указатель артефактов

| Документ                                                                 | Назначение                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [openAPI.yaml](openAPI.yaml)                                             | HTTP-контракт (часть путей `/deals/*` — legacy, в коде — `/bookings/*`) |
| [moderation-draft-ai.md](moderation-draft-ai.md)                         | Автомодерация текста: rules + Ollama                                    |
| [sequence/](sequence/)                                                   | Use cases (sequence-диаграммы)                                          |
| [state/](state/)                                                         | Диаграммы состояний (enum из Prisma + фактические переходы)             |
| [class/](class/)                                                         | Доменная модель (соответствует Prisma)                                  |
| [architectureOfDB/architectureDB.md](architectureOfDB/architectureDB.md) | ER-диаграмма PostgreSQL                                                 |
| [flowshart/flowchart.md](flowshart/flowchart.md)                         | Архитектура сервисов (production)                                       |
| [yandex-s3-setup.md](yandex-s3-setup.md)                                 | S3 / Yandex Object Storage                                              |

## Ключевые отличия от ранних версий docs

- **Поиск:** `GET /search`, `GET /search/autocomplete` → Elasticsearch + гидратация из Postgres.
- **Публикация объявления:** автомодерация → сразу `ACTIVE` (не очередь `PENDING_MODERATION`).
- **Модерация:** только текст при create/update/publish; `warn` и `block` → **422**, запись не сохраняется.
- **Бронирование:** `POST /bookings` → `PENDING_PAYMENT` → `CONFIRMED` | `PAYMENT_FAILED`; возврат — `POST /bookings/:id/return/confirm`.
- **Демо-каталог:** автосид отключён (`CATALOG_DEFAULT_SEED_ENABLED=false` по умолчанию).
- **Нет в коде:** избранное, чат сделки, handover-чеклисты, `/deals/*`, панель модератора, Redis-сессии.

## Production API

Браузер обращается к `https://$DOMAIN/api/...` (Caddy снимает префикс `/api`). Внутри Docker backend слушает `:3000` без префикса `/api/v1`.
