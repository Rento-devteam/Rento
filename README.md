# Rento — платформа для аренды вещей

Монорепозиторий: **NestJS** (API) + **React** (веб-клиент), общие типы в пакете **shared**.

## Материалы и артефакты

| Ресурс | Ссылка |
|--------|--------|
| Документация (Google Docs) | [О-23-ИСП-2-СПО — документ](https://docs.google.com/document/d/1RW9IpYSdksEtEWKxD4l4UHHZKeqMb_QzlF8XSnzcMGQ/edit) |
| Дизайн (Figma) | [Rento — макеты](https://www.figma.com/design/oBB3tKDgPnpHQt9vAnei7I/Rento) |
| Задачи (Trello) | [Rento — доска](https://trello.com/b/FZHRKeAm/rento) |
| OpenAPI (в репозитории) | [docs/openAPI.yaml](https://app.swaggerhub.com/apis-docs/rento-281/openAPI/1.0.0?view=elementsDocs) |
| Диаграммы и состояния | [docs/sequence/](docs/sequence/), [docs/state/](docs/state/) |

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

## О проекте

**Rento** — платформа для безопасной аренды вещей между пользователями. Репозиторий организован как **npm workspaces** в каталоге `packages/`.

### Особенности репозитория

- изолированные пакеты `backend`, `frontend`, `shared`;
- TypeScript во всех пакетах;
- CI на GitHub Actions: [.github/workflows/ci.yml](.github/workflows/ci.yml);
- соглашение о коммитах: [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/).

## Структура репозитория

```text
Rento/
├── packages/
│   ├── backend/          # NestJS API, Prisma, Docker Compose (Postgres + Elasticsearch)
│   ├── frontend/         # React + Vite
│   ├── shared/           # общие типы и сборка tsc → dist
│   └── package.json      # workspaces и общие npm-скрипты
├── docs/                 # OpenAPI, сценарии (sequence), модели состояний
├── .github/              # CI, шаблоны PR и issues, CODEOWNERS
├── package.json          # Husky / commitlint (корень монорепозитория)
├── tsconfig.json         # базовые опции TypeScript
└── README.md
```

## Быстрый старт

### Требования

- [Node.js](https://nodejs.org/) **22.x** (как в CI; требование цепочки Prisma 7) или новее
- [npm](https://docs.npmjs.com/cli/v10/commands/npm) **9+**
- для локального API: [Docker Engine](https://docs.docker.com/engine/) + Docker Compose (см. `packages/backend/docker-compose.dev.yml`)

### Установка зависимостей

Рабочая область npm — каталог **`packages/`** (там объявлены `workspaces`).

```bash
git clone https://github.com/Rento-team/Rento.git
cd Rento/packages
npm install
```

Опционально, из **корня** репозитория (`Rento/`), чтобы подтянуть Husky и commitlint для git-хуков:

```bash
cd Rento
npm install
```

### База данных и поиск (Docker)

Из каталога `packages/backend`:

```bash
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy
```

Postgres будет доступен на хосте на порту **5434**, Elasticsearch — **http://localhost:9200** (как в `packages/backend/.env.example`).

### Разработка

Из каталога `packages/`:

```bash
npm run dev
```

Запускаются воркспейсы со скриптом `dev` (сейчас это **backend** и **frontend**). Адреса по умолчанию:

- API: [http://localhost:3000](http://localhost:3000)
- фронтенд: [http://localhost:5173](http://localhost:5173)

Отдельно:

```bash
npm run dev:backend
npm run dev:frontend
```

### Сборка и проверки

```bash
npm run build
npm run build:backend
npm run build:frontend
npm run lint
npm run lint:all
npm run test
npm run clean
```

## Команды в `packages/`

| Команда | Описание |
|---------|----------|
| `npm run dev` | dev-серверы пакетов со скриптом `dev` |
| `npm run dev:backend` | только NestJS (`nest start --watch`) |
| `npm run dev:frontend` | только Vite |
| `npm run build` | сборка всех воркспейсов |
| `npm run build:backend` / `build:frontend` | выборочная сборка |
| `npm run lint` | как в CI: shared + frontend |
| `npm run lint:all` | ESLint / проверки во всех пакетах |
| `npm run test` | тесты во всех воркспейсах |
| `npm run clean` | очистка артефактов (см. скрипты пакетов) |

## Переменные окружения

- **Backend:** скопируйте [`packages/backend/.env.example`](packages/backend/.env.example) в `packages/backend/.env` и при необходимости поправьте значения (БД, JWT, SMTP, S3, Elasticsearch и т.д.).
- **Frontend:** пример — [`packages/frontend/.env.example`](packages/frontend/.env.example); для Vite удобнее имя **`.env.local`**. Обязательный для API префикс: **`VITE_API_BASE_URL`** (по умолчанию в коде подставляется `http://localhost:3000`).

## Технологии и документация к инструментам

| Область | Стек | Документация |
|---------|------|----------------|
| API | [NestJS](https://docs.nestjs.com/) 11, [Prisma](https://www.prisma.io/docs), PostgreSQL | [Prisma Postgres](https://www.prisma.io/docs/orm/overview/databases/postgresql) |
| Поиск | [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html) (клиент: [@elastic/elasticsearch](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html)) | см. переменные `ELASTICSEARCH_*` в `.env.example` |
| Хранилище файлов | [AWS SDK for JavaScript v3 — S3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/) | совместимо с S3-совместимыми сервисами (MinIO, Yandex Object Storage и т.п.) |
| Тесты (backend) | [Jest](https://jestjs.io/docs/getting-started) | `packages/backend` |
| Клиент | [React](https://react.dev/) 19, [React Router](https://reactrouter.com/) 7 | — |
| Сборка клиента | [Vite](https://vite.dev/guide/) | [Env and modes](https://vite.dev/guide/env-and-mode.html) |
| Тесты (frontend) | [Vitest](https://vitest.dev/guide/), [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | `packages/frontend` |
| Линтинг | [ESLint](https://eslint.org/docs/latest/) | конфиги в пакетах |

## Соглашение о коммитах

**Зачем это луркеру:** по первой строке сообщения видно, *что* изменилось и *насколько* это важно для пользователя или сборки. История `git log` читается как список новостей, а не как «правки» и «ещё правки».

Используется стиль [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/). Формат в общем виде:

```text
<тип>[необязательная область]: краткое описание на русском или английском

[пустая строка]

[необязательно — подробности, ссылки на issue, скриншоты]
```

- **Тип** — одно слово до двоеточия; дальше — короткая фраза в повелительном наклонении («добавить», «исправить»), без точки в конце первой строки.
- **Область (scope)** — опционально, если затронут конкретный пакет или модуль, например `feat(backend):` или `fix(frontend):`.
- **Breaking change** (ломающее изменение для API или конфигов): в типе можно указать `!`, например `feat!:`, или в теле коммита добавить абзац, начинающийся с `BREAKING CHANGE:`.

### Часто используемые типы

| Тип | Простыми словами |
|-----|------------------|
| `feat` | Новая возможность для пользователя или публичного API (то, что можно упомянуть в релиз-нотах как «появилось»). |
| `fix` | Исправление бага: что-то работало не так или падало — стало как задумано. |
| `docs` | Только документация: README, комментарии в коде, OpenAPI-описания и т.п., без изменения поведения приложения. |
| `style` | Форматирование, пробелы, точки с запятой — логика кода не меняется. |
| `refactor` | Перестройка кода без новой фичи и без исправления бага (удобнее читать, проще поддерживать). |
| `perf` | Ускорение или снижение нагрузки (важно для API и тяжёлых экранов). |
| `test` | Тесты: новые, исправленные, моки — не продакшен-логика. |
| `build` | Сборка, зависимости, CI-скрипты, конфиги bundler/TypeScript. |
| `ci` | Конкретно пайплайны GitHub Actions и подобное. |
| `chore` | Рутина, не попадающая в другие типы (обновление lockfile без смены API, мелкие служебные правки). |
| `revert` | Откат ранее влитого коммита (обычно с указанием, что именно откатывается). |

Примеры заголовков:

```text
feat(frontend): добавить страницу списка объявлений
fix(backend): корректно валидировать даты бронирования
docs: описать переменные окружения для Elasticsearch
chore: обновить зависимости в корневом package.json
```

Проверка формата при коммите настроена через **commitlint** и **Husky** в корне репозитория (см. [.commitlintrc.json](.commitlintrc.json) и установку `npm install` из корня `Rento/`). Если хук отклонил сообщение — перепишите первую строку по таблице выше.

## Команда

| Роль | Имя |
|------|-----|
| Delivery Manager | Карпеко А.С. |
| Tester | Антонов А.Д. |
| Backender | Ким А.А. |
| Frontender | Луговая Д.А. |
| Analytic | Мельникова К.А. |
| Designer | Рыбаков Д.С. |
| Backender | Терещенков К.А. |
| Tester | Фомичева А.С. |
