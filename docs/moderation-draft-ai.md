# Модерация текста объявления (черновик + публикация)

## Цель

Автоматически проверять **название** и **описание** объявления при:

- создании черновика (`POST /listings`);
- изменении текста в своём объявлении (`PATCH /listings/owned/:listingId`, поля `title` / `description`);
- публикации (`POST /listings/:listingId/publish`) — **более строгий** режим.

Проверка **гибридная**:

1. **Rule engine** — быстрые эвристики и словарь (мат, мусор, «гиббериш», спам-паттерны).
2. **Llama через Ollama** — JSON-ответ с `status`, `confidence`, `reasons`, `flags` (см. `packages/backend/src/moderation/moderation-result.schema.ts`).

Если правила дают **жёсткий матч** (`hard_block` по профанити), **LLM не вызывается**.

## Исходы

| Исход   | HTTP    | Поведение                                                                                                                   |
| ------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `allow` | 200/201 | В БД: `moderationStatus=ALLOW`, при необходимости обновляются версия/уверенность.                                           |
| `warn`  | 200/201 | Черновик сохраняется: `moderationStatus=WARN`, в ответе — причины.                                                          |
| `block` | **422** | Текст **не** сохраняется для create/update; публикация не выполняется. Тело: `ModerationBlockedError` (см. `openAPI.yaml`). |

Отключение жёстких блокировок: `MODERATION_HARD_BLOCK_ENABLED=false` — вместо `block` возвращается `warn` (для пилотов).

## Переменные окружения (backend)

См. также `packages/backend/.env.example`.

| Переменная                              | По умолчанию             | Описание                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MODERATION_ENABLED`                    | `true`                   | Включить пайплайн модерации.                                                                                                                                                                               |
| `MODERATION_HARD_BLOCK_ENABLED`         | `true`                   | Разрешить итоговый статус `block` (422).                                                                                                                                                                   |
| `MODERATION_LLM_ENABLED`                | `true`                   | Вызывать Ollama после правил (если нет `hard_block`).                                                                                                                                                      |
| `MODERATION_LLM_BASE_URL`               | `http://localhost:11435` | URL Ollama. В `docker-compose.dev.yml` контейнер проброшен на **11435** хоста, чтобы не конфликтовать с нативным Ollama на **11434**.                                                                      |
| `MODERATION_LLM_MODEL`                  | `llama3.1:8b`            | Имя — **первый столбец** `docker exec -it rento-ollama ollama list`. Для нативного Ollama на `:11434` выставьте `MODERATION_LLM_BASE_URL=http://localhost:11434` и модель из **локального** `ollama list`. |
| `MODERATION_LLM_TIMEOUT_MS`             | `45000`                  | Таймаут запроса (черновик), мс. Первый прогон модели на CPU часто 15–40 с.                                                                                                                                 |
| `MODERATION_LLM_PUBLISH_TIMEOUT_MS`     | `90000`                  | Таймаут запроса (публикация), мс.                                                                                                                                                                          |
| `MODERATION_LLM_MAX_RETRIES`            | `2`                      | Повторы при сетевых/HTTP ошибках.                                                                                                                                                                          |
| `MODERATION_LLM_TRAFFIC_PERCENT`        | `100`                    | Доля запросов с вызовом LLM (0–100), для поэтапного rollout.                                                                                                                                               |
| `MODERATION_BLOCK_THRESHOLD`            | `0.85`                   | Порог уверенности для блокировки по LLM (profanity / общий block).                                                                                                                                         |
| `MODERATION_WARN_THRESHOLD`             | `0.6`                    | Нижняя граница «подозрительно».                                                                                                                                                                            |
| `MODERATION_GIBBERISH_BLOCK_CONFIDENCE` | `0.8`                    | На **publish** при `gibberish` и confidence ≥ этого значения — `block` (если hard-block включён).                                                                                                          |
| `MODERATION_VERSION`                    | `2`                      | Версия логики/промпта, пишется в `Listing.moderationVersion`.                                                                                                                                              |

Поле **`confidence` в ответе LLM** — это не «оценка красоты объявления», а **насколько модель уверена в своём `status` и флагах**. В промпте задана калибровка: для явно нормального арендного текста при `allow` ожидаются значения **0.88–1.0**, чтобы не путать уверенность в классификации с субъективным «качеством» текста.

При недоступности LLM срабатывает **fallback**: только правила; если правил недостаточно и модель не ответила — итог консервативно уходит в `warn`, а не в «тихий» `allow`.

## Частая ошибка: `Ollama HTTP 404` / `model '…' not found`

Означает: **у того экземпляра Ollama**, на который уходит `MODERATION_LLM_BASE_URL` (например `http://localhost:11435/api/chat` для Docker из этого репозитория), **нет модели** с таким именем (или имя не совпадает с тегом после `pull`).

### 1. Два разных Ollama (Windows + Docker)

Нативный **Ollama для Windows** обычно слушает **11434**. Контейнер **`rento-ollama` в этом репозитории** проброшен на хост **`11435` → 11434` внутри контейнера**, чтобы Nest по умолчанию ходил в **Docker**, а не в пустой/другой каталог на `:11434`.

Проверка:

```powershell
ollama list
docker exec -it rento-ollama ollama list
```

В `.env` backend: **`MODERATION_LLM_BASE_URL`** и **`MODERATION_LLM_MODEL`** должны соответствовать **одному** выбранному экземпляру (см. `packages/backend/.env.example`).

### 2. Имя в `.env` ≠ имя после `pull`

Команда `ollama pull llama3.1` обычно даёт в списке **`llama3.1:latest`**, а не `llama3.1:8b`. В `MODERATION_LLM_MODEL` нужно указать **точную строку из первого столбца** `ollama list` (например `llama3.1:latest`).

Проверка на том же хосте, куда смотрит backend:

```bash
ollama list
```

Если модели нет в **Docker**:

```bash
docker exec -it rento-ollama ollama pull llama3.1:8b
```

Для **нативного** Ollama на `:11434` — по желанию `ollama pull llama3.1` или другой тег из [llama3.1/tags](https://ollama.com/library/llama3.1/tags); в `.env` укажите **`MODERATION_LLM_BASE_URL=http://localhost:11434`** и имя из **локального** `ollama list`.

Если `ollama pull …` выдаёт `pull model manifest: file does not exist` — такого тега нет в каталоге; см. [llama3.1/tags](https://ollama.com/library/llama3.1/tags).

`MODERATION_LLM_BASE_URL` — **корень** Ollama (без `/api`), например `http://localhost:11435` для Docker из `docker-compose.dev.yml` или `http://localhost:11434` для нативной установки.

## Docker: отдельный контейнер Ollama

В `packages/backend/docker-compose.dev.yml` сервис **`ollama`** проброшен на хост **`11435`** (внутри контейнера по-прежнему **11434**), том `rento_ollama_data`. После `docker compose up`:

```bash
docker exec -it rento-ollama ollama pull llama3.1:8b
```

Backend на хосте по умолчанию: `MODERATION_LLM_BASE_URL=http://localhost:11435`, `MODERATION_LLM_MODEL=llama3.1:8b`. Если Nest в той же Docker-сети compose — `MODERATION_LLM_BASE_URL=http://ollama:11434`.

## Как на 100% убедиться, что LLM работает

1. **Эндпоинт проверки** (тот же сетевой путь, что и при модерации объявления):
   - `GET /health/moderation-llm` — Ollama доступен и модель из `MODERATION_LLM_MODEL` есть в `ollama list`.
   - `GET /health/moderation-llm?inference=1` — плюс тестовый запрос в модель; в ответе должно быть `"ok": true`, `"inferenceOk": true`.

   Пример с сервера:

   ```bash
   curl -s http://localhost:3000/health/moderation-llm | jq
   curl -s "http://localhost:3000/health/moderation-llm?inference=1" | jq
   ```

   (порт backend смотрите в compose; с хоста — через проброс или `docker exec rento-backend wget -qO- http://127.0.0.1:3000/health/moderation-llm`)

2. **Лог при старте backend**: `LLM moderation ready: http://ollama:11434 model=…` или `LLM moderation NOT ready` с подсказкой.

3. **При создании черновика** в логе `listing_text_moderation` должно быть **`"usedLlm": true`** (не `false`). Если `usedLlm: false` и `fetch failed` — смотрите `hint` в `/health/moderation-llm`.

### Частая причина `fetch failed` в Docker

- В `deploy/.env` указан `MODERATION_LLM_BASE_URL=http://localhost:11435` — для контейнера backend это **не** Ollama. Удалите переменную или задайте `http://ollama:11434`.
- У backend переопределён DNS без `127.0.0.11` — имя `ollama` не резолвится. В `deploy/docker-compose.yml` первым DNS должен быть `127.0.0.11`.

```bash
docker exec rento-ollama ollama pull llama3.1:8b
docker compose -f deploy/docker-compose.yml up -d --force-recreate backend
```

## Калибровка качества (без «обучения» Llama)

Для настройки порогов и снижения ложных срабатываний нужен **размеченный датасет** объявлений (классы `allow` / `warn` / `block` и теги). Объём **500–2000** примеров — это не обучение весов модели, а **оценка и калибровка** порогов и правил на вашем домене.

## Код

| Компонент               | Путь                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| Модуль Nest             | `packages/backend/src/moderation/`                                               |
| Интеграция в объявления | `packages/backend/src/listings/listings.service.ts`                              |
| Миграция БД             | `packages/backend/prisma/migrations/*_listing_text_moderation/`                  |
| Контракт API            | `docs/openAPI.yaml` (`ModerationBlockedError`, поля модерации в `ListingDetail`) |
