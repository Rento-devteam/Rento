# Review — отзывы после сделки

**Статус в коде:** не реализовано (нет модели `Review` в Prisma).

```mermaid
stateDiagram-v2
    [*] --> Draft: Запланировано (UC-17)

    Draft --> Published: Запланировано
    Published --> Visible: Запланировано
    Visible --> Reported: Запланировано
    Reported --> Hidden: Запланировано
    Reported --> Visible: жалоба отклонена

    Published --> DeletedByAuthor: Запланировано
    Hidden --> DeletedByModerator: Запланировано
```

**Связь с ARS:** пересчёт `TrustScore` — `POST /internal/trust-score/recalculate` (внутренний API, реализован).
