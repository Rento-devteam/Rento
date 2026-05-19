# Listing — статусы объявления

**Источник:** `ListingStatus`, модерация текста — `ListingTextModerationStatus`  
**Реализовано:** `DRAFT` → (модерация при publish) → `ACTIVE`; удаление — hard delete.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: POST /listings<br/>(модерация phase=draft, allow)

    state DRAFT {
        [*] --> Editing
        Editing --> Editing: PATCH /listings/owned/:id<br/>+ фото POST/DELETE
        Editing --> ReadyToPublish: ≥1 фото
    }

    DRAFT --> ACTIVE: POST /listings/:id/publish<br/>модерация phase=publish + allow
    DRAFT --> [*]: DELETE /listings/:id

    ACTIVE --> ACTIVE: PATCH /listings/owned/:id<br/>(реиндекс ES)
    ACTIVE --> [*]: DELETE /listings/:id<br/>(если нет блокирующих броней)

    note right of PENDING_MODERATION
        Enum в схеме;
        в коде не используется
    end note

    note right of ARCHIVED
        Enum в схеме;
        удаление физическое, не ARCHIVED
    end note

    note right of BLOCKED
        Enum в схеме;
        админ-блок — запланирован
    end note
```

## Модерация текста (не статус Listing)

При `create` / `update` (title, description) / `publish`:

| Итог пайплайна | HTTP    | Запись в БД                                                   |
| -------------- | ------- | ------------------------------------------------------------- |
| allow          | 200/201 | сохраняется, `moderationStatus=ALLOW`                         |
| warn или block | **422** | **не** сохраняется (create/update) или publish не выполняется |

Пайплайн: **RulesEngine** → (опционально) **Ollama** → `fuseModeration`. См. [moderation-draft-ai.md](../moderation-draft-ai.md).

## Индекс поиска

При переходе в `ACTIVE` и при правках активного объявления — индексация в Elasticsearch (`rento-listings`).
