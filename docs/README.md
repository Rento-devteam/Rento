# Документация Rento (репозиторий)

Краткий указатель артефактов в каталоге `docs/`:

| Документ | Назначение |
|----------|------------|
| [openAPI.yaml](openAPI.yaml) | Контракт HTTP API (актуализируется вместе с backend). |
| [moderation-draft-ai.md](moderation-draft-ai.md) | Модерация текста объявления на этапе черновика: правила + Llama (Ollama), переменные окружения, Docker. |
| [sequence/](sequence/) | Сценарии (use cases) в виде sequence-диаграмм. |
| [state/](state/) | Модели состояний сущностей. |
| [class/](class/) | Диаграммы классов / логика. |
| [architectureOfDB/](architectureOfDB/) | Архитектура БД. |
| [flowshart/flowchart.md](flowshart/flowchart.md) | Блок-схемы. |
| [yandex-s3-setup.md](yandex-s3-setup.md) | Настройка S3-совместимого хранилища. |

**Замечание по OpenAPI и backend:** часть путей в `openAPI.yaml` исторически отличается от NestJS (например, обновление своего объявления в коде — `PATCH /listings/owned/{listingId}`). Приоритет при разработке — фактические маршруты в `packages/backend/src/**/*.controller.ts`; OpenAPI постепенно выравнивается.
