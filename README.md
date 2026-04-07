# 🚗 Rento - Монорепозиторий NestJS + React

[![CI](https://github.com/Rento-team/Rento/actions/workflows/ci.yml/badge.svg)](https://github.com/Rento-team/Rento/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 О проекте

**Rento** — это платформа для аренды автомобилей. Проект построен на архитектуре монорепозитория с использованием **NestJS** на бэкенде и **React** на фронтенде.

### Ключевые особенности
- 🏗 Монорепозиторий на npm workspaces
- 🔐 TypeScript строгая типизация
- 🚀 Быстрая разработка с hot-reload
- 📦 Изолированные пакеты для бэкенда и фронтенда

## 🏗 Структура проекта
Rento/
├── 📁 packages/
│ ├── 🖥️ backend/ # NestJS бэкенд
│ │ ├── src/ # Исходный код
│ │ ├── test/ # Тесты
│ │ └── package.json
│ └── 🎨 frontend/ # React + Vite фронтенд
│ ├── src/ # Исходный код
│ ├── public/ # Статические файлы
│ └── package.json
├── 📁 .github/ # GitHub конфигурации
│ ├── workflows/ # CI/CD пайплайны
│ ├── CODEOWNERS # Назначение ревьюверов
│ └── pull_request_template.md
├── 📄 package.json # Корневая конфигурация
├── 📄 .gitignore # Игнорируемые файлы
└── 📄 README.md # Документация

text

## 🚀 Быстрый старт

### Требования
- **Node.js** 18.x или выше
- **npm** 9.x или выше

### Установка

```bash
# Клонируйте репозиторий
git clone https://github.com/Rento-team/Rento.git
cd Rento

# Установите все зависимости
npm install
Разработка
bash
# Запустить все проекты одновременно
npm run dev

# Или по отдельности:
npm run dev:backend   # Запуск только бэкенда (http://localhost:3000)
npm run dev:frontend  # Запуск только фронтенда (http://localhost:5173)
Сборка
bash
# Собрать все проекты
npm run build

# Собрать конкретный проект
npm run build:backend
npm run build:frontend
📦 Команды
Команда	Описание
npm run dev	Запуск всех проектов в режиме разработки
npm run dev:backend	Запуск только бэкенда
npm run dev:frontend	Запуск только фронтенда
npm run build	Сборка всех проектов
npm run lint	Проверка кода во всех проектах
npm run test	Запуск тестов
npm run clean	Очистка сборок
🛠 Технологии
Бэкенд
NestJS — прогрессивный Node.js фреймворк

TypeScript — типизированный JavaScript

Jest — тестирование

Фронтенд
React 18 — библиотека для UI

Vite — быстрый сборщик

TypeScript — типизация

ESLint — линтинг кода

🔧 Настройка окружения
Создайте файлы .env в соответствующих пакетах:

Бэкенд (packages/backend/.env)
env
PORT=3000
NODE_ENV=development
Фронтенд (packages/frontend/.env)
env
VITE_API_URL=http://localhost:3000

Правила коммитов
Используем Conventional Commits:

feat: — новая функциональность

fix: — исправление ошибки

docs: — обновление документации

style: — форматирование кода

refactor: — рефакторинг

test: — добавление тестов

chore: — обслуживание проекта

👥 Команда
Роль	Имя
👨‍💻 Delivery Manager	   Карпеко А.С.
👨‍💻 Tester	           Антонов А.Д.
👨‍💻 Backender	           Ким А.А.
👨‍💻 Frontender	       Луговая Д.А.
👨‍💻 Analytic	           Мельникова К.А.
👨‍💻 Designer	           Рыбаков Д.С.
👨‍💻 Backender	           Терещенков К.А.
👨‍💻 Tester	           Фомичева А.С.
