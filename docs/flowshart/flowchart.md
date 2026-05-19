# Архитектура системы (production)

Соответствует `deploy/docker-compose.yml` и модулям NestJS.

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

    FE -.->|JWT| Caddy
    Bot --> API

    API --> PG
    API --> ES
    API --> S3
    API --> Ollama
    API --> ESIA
    API --> YGeo
    API --> SMTP
    API --> Pay

    subgraph API_Modules [Модули backend — реализовано]
        direction TB
        M1[Auth + Telegram login]
        M2[Listings + Calendar]
        M3[Search]
        M4[Bookings + Payments hold]
        M5[Moderation rules+LLM]
        M6[Geo + Verification + TrustScore]
    end

    API --> API_Modules
```

## Не в текущем production-стеке

| Компонент                                | Статус                                     |
| ---------------------------------------- | ------------------------------------------ |
| Redis (сессии/кэш)                       | Не используется — JWT + refresh в Postgres |
| Chat / WebSocket                         | Запланировано                              |
| Dispute / Report admin                   | Запланировано                              |
| ИИ-рекомендации (`GET /recommendations`) | Запланировано                              |
| PWA offline                              | Запланировано                              |

## Переменные окружения (ключевые)

| Сервис       | Примеры                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| backend      | `DATABASE_URL`, `ELASTICSEARCH_NODE`, `MODERATION_LLM_*`, `S3_*`, `JWT_*`, `YANDEX_GEOCODER_API_KEY` |
| telegram-bot | `BOT_TOKEN`, `BOT_SECRET`, `PUBLIC_BOT_BASE_URL`, `BACKEND_BASE_URL`                                 |
| compose      | `CATALOG_DEFAULT_SEED_ENABLED=false` (демо-каталог выключен)                                         |
