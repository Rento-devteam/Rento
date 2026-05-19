# Платёж / холд по бронированию

Отдельной таблицы `Transaction` в Prisma **нет**. Финансовое состояние хранится в **`Booking`**: `amountHeld`, `paymentHoldId`, `paymentGateway`, `settlementStatus`.

```mermaid
stateDiagram-v2
    [*] --> NoHold: до POST /bookings

    NoHold --> HoldPending: создание брони PENDING_PAYMENT
    HoldPending --> HoldActive: CONFIRMED<br/>(paymentHoldId сохранён)
    HoldPending --> HoldFailed: PAYMENT_FAILED

    HoldFailed --> HoldActive: retry-payment OK

    HoldActive --> Settling: return confirm → settlement PENDING
    Settling --> Settled: settlement SETTLED
    Settling --> SettleFailed: settlement FAILED
    SettleFailed --> Settling: cron retry

    Settled --> [*]
    HoldFailed --> [*]: cancel
```

**Запланировано (ТЗ):** отдельная сущность escrow-транзакций, частичные release, спор → refund — в текущем коде упрощено до полей брони и settlement job.
