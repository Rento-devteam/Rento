# Архитектура системы (production)

Соответствует `deploy/docker-compose.yml`. **Redis** — по [redis-plan.md](../redis-plan.md) (внедрение в работе).

```mermaid
flowchart LR
    User[Пользователь]
    TG[Telegram]

    subgraph Edge [Публичный вход]
        Caddy[Caddy HTTPS<br/>:80 / :443]
    end

    subgraph Apps [Приложения Docker]
        FE[frontend<br/>React SPA]
        API[backend<br/>NestJS :3000]
        Bot[telegram-bot<br/>:3010]
    end

    subgraph Data [Данные]
        PG[(PostgreSQL)]
        ES[(Elasticsearch)]
        R[(Redis<br/>сессии + кэш поиска)]
        S3[(S3 фото)]
        Ollama[Ollama LLM]
    end

    subgraph External [Внешние API]
        ESIA[ЕСИА verify]
        YGeo[Yandex Geocoder]
        SMTP[Email SMTP]
        Pay[Платёжный шлюз]
    end

    User --> Caddy
    TG --> Caddy
    Caddy -->|/| FE
    Caddy -->|/api/*| API
    Caddy -->|/telegram/webhook*| Bot

    FE -.->|JWT access + refresh| Caddy
    Bot --> API

    API --> PG
    API --> ES
    API --> R
    API --> S3
    API --> Ollama
    API --> ESIA
    API --> YGeo
    API --> SMTP
    API --> Pay

    subgraph API_Modules [Модули backend]
        direction TB
        M1[Auth + refresh / sessions]
        M2[Listings + Calendar]
        M3[Search + ES cache]
        M4[Bookings + Payments]
        M5[Moderation rules+LLM]
        M6[Geo + Verification + TrustScore]
    end

    API --> API_Modules
```

## Потоки через Redis (план)

| Поток                | Redis               | Postgres / ES          |
| -------------------- | ------------------- | ---------------------- |
| Login                | `SET session:{sid}` | User                   |
| `POST /auth/refresh` | read/rotate session | User status            |
| `GET /search`        | cache hit → skip ES | miss → ES + hydrate PG |
| Publish listing      | `DEL search:*`      | UPDATE + ES index      |

## Статус компонентов

| Компонент                  | Статус                                            |
| -------------------------- | ------------------------------------------------- |
| PostgreSQL, ES, S3, Ollama | Реализовано                                       |
| Redis                      | Запланировано ([redis-plan.md](../redis-plan.md)) |
| Chat / WebSocket           | Запланировано                                     |
| Панель модератора          | Запланировано                                     |

## Переменные окружения (ключевые)

| Сервис       | Примеры                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| backend      | `DATABASE_URL`, `ELASTICSEARCH_NODE`, `REDIS_URL`, `JWT_*`, `MODERATION_LLM_*`, `S3_*` |
| telegram-bot | `BOT_TOKEN`, `BOT_SECRET`, `BACKEND_BASE_URL`                                          |
| compose      | `CATALOG_DEFAULT_SEED_ENABLED=false`                                                   |
