# 🏠 Rento — Платформа для аренды вещей

**Современная платформа для аренды любых вещей**  
*Монорепозиторий на NestJS + React*

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

---

## 📋 О проекте

**Rento** — это удобная и безопасная платформа для аренды вещей между людьми.  
Проект построен по архитектуре **монорепозитория** с использованием:

- **NestJS** — на бэкенде
- **React + Vite** — на фронтенде

### Ключевые особенности

- 🏗 **Монорепозиторий** на `npm workspaces`
- 🔐 **Строгая типизация** TypeScript
- 🚀 **Горячая перезагрузка** (hot-reload) для быстрой разработки
- 📦 **Полностью изолированные пакеты** backend и frontend
- 🔄 **CI/CD** через GitHub Actions
- 📋 **Conventional Commits** для чистой истории

---

## 🏗 Структура проекта

```bash
Rento/
├── 📁 packages/
│   ├── 🖥️ backend/          # NestJS бэкенд
│   │   ├── src/             # Исходный код
│   │   ├── test/            # Тесты
│   │   └── package.json
│   └── 🎨 frontend/         # React + Vite фронтенд
│       ├── src/             # Исходный код
│       ├── public/          # Статические файлы
│       └── package.json
├── 📁 .github/
│   ├── workflows/           # CI/CD пайплайны
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── 📄 package.json          # Корневая конфигурация
├── 📄 .gitignore
├── 📄 .env.example
└── 📄 README.md
```
## 🚀 Быстрый старт

### Требования
- **Node.js** 18.x или выше
- **npm** 9.x или выше

### Установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/Rento-team/Rento.git
cd Rento

# 2. Установите все зависимости
npm install
```
### Разработка

```bash
# Запуск всех проектов одновременно (рекомендуется)
npm run dev

# Или по отдельности:
npm run dev:backend    # Бэкенд → http://localhost:3000
npm run dev:frontend   # Фронтенд → http://localhost:5173
```

### Сборка
```bash
# Собрать все проекты
npm run build

# Собрать только нужный проект
npm run build:backend
npm run build:frontend
```

## 📦 Команды

| Команда                    | Описание                                              |
|----------------------------|-------------------------------------------------------|
| `npm run dev`              | Запуск всех проектов в режиме разработки             |
| `npm run dev:backend`      | Запуск только бэкенда                                |
| `npm run dev:frontend`     | Запуск только фронтенда                              |
| `npm run build`            | Полная сборка всех проектов                          |
| `npm run build:backend`    | Сборка только бэкенда                                |
| `npm run build:frontend`   | Сборка только фронтенда                              |
| `npm run lint`             | Проверка кода ESLint во всех пакетах                 |
| `npm run test`             | Запуск всех тестов                                   |
| `npm run clean`            | Очистка папок `dist` и `node_modules`               |

---

## 🛠 Технологии

### Бэкенд
- **NestJS** — прогрессивный Node.js-фреймворк
- **TypeScript** — строгая типизация
- **Jest** — тестирование
- **Prisma / TypeORM** — работа с базой данных

### Фронтенд
- **React 18** — современный пользовательский интерфейс
- **Vite** — сверхбыстрый сборщик
- **TypeScript** — типизация
- **ESLint + Prettier** — качество кода
- **Tailwind CSS / Styled Components** — стилизация (по выбору команды)

---

## 🔧 Настройка окружения

Создайте файлы `.env` в соответствующих пакетах:

**Бэкенд** (`packages/backend/.env`)
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/rento
JWT_SECRET=your-super-secret-jwt-key
```

**Фронтенд** (`packages/frontend/.env`)
```env
VITE_API_URL=http://localhost:3000
```

> Примеры файлов окружения находятся в `.env.example`  
> (в корне проекта и в каждом пакете: `packages/backend/` и `packages/frontend/`).

---

## 📝 Правила коммитов

Мы используем **Conventional Commits** для чистой и понятной истории проекта:

- `feat:` — новая функциональность
- `fix:` — исправление ошибки
- `docs:` — обновление документации
- `style:` — форматирование кода
- `refactor:` — рефакторинг
- `test:` — добавление или исправление тестов
- `chore:` — обслуживание проекта (без изменений в коде)

---

## 👥 Команда

| Роль                  | Имя                |
|-----------------------|--------------------|
| 👨‍💻 Delivery Manager    | Карпеко А.С.      |
| 👨‍💻 Tester              | Антонов А.Д.      |
| 👨‍💻 Backender           | Ким А.А.          |
| 👨‍💻 Frontender          | Луговая Д.А.      |
| 👨‍💻 Analytic            | Мельникова К.А.   |
| 👨‍💻 Designer            | Рыбаков Д.С.      |
| 👨‍💻 Backender           | Терещенков К.А.   |
| 👨‍💻 Tester              | Фомичева А.С.     |

---