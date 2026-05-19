# Dispute — спор по бронированию

**Статус в коде:** `BookingStatus.DISPUTED` объявлен в Prisma и учитывается при блокировке дат календаря, но **переход в `DISPUTED` в workflow не реализован**.

```mermaid
stateDiagram-v2
    [*] --> NotDisputed: обычное бронирование

    NotDisputed --> DISPUTED: Запланировано<br/>(FR-502, UC-19)

    state DISPUTED {
        [*] --> Open
        Open --> ResolvedRenter: Запланировано
        Open --> ResolvedOwner: Запланировано
        Open --> ResolvedSplit: Запланировано
    }

    DISPUTED --> COMPLETED: Запланировано
    DISPUTED --> CANCELLED: Запланировано
```

**Реализовано сейчас:** взаимное подтверждение возврата без спора — `POST /bookings/:bookingId/return/confirm` → `COMPLETED` (см. [Booking.md](Booking.md), UC-15).

**Legacy в OpenAPI:** пути `/deals/{dealId}/...` — в NestJS используйте `/bookings/{bookingId}/...`.
