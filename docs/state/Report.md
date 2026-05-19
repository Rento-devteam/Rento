# Report — жалобы на контент

**Статус в коде:** не реализовано (нет модели `Report` в Prisma, нет панели модератора UC-21).

```mermaid
stateDiagram-v2
    [*] --> Created: Запланировано

    Created --> Pending: Запланировано
    Pending --> Investigating: Запланировано
    Investigating --> Resolved: Запланировано
    Investigating --> Dismissed: Запланировано
    Resolved --> Closed: Запланировано
    Dismissed --> Closed: Запланировано
    Closed --> [*]
```

**Реализованная модерация сейчас:** только автоматическая проверка **текста объявления** (rules + LLM), см. [moderation-draft-ai.md](../moderation-draft-ai.md).
