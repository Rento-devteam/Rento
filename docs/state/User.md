# User — статусы аккаунта

**Источник:** `UserStatus` в `packages/backend/prisma/schema.prisma`  
**Реализованные переходы:** регистрация по email, подтверждение email, вход, привязка Telegram, прямой вход через бота.

```mermaid
stateDiagram-v2
    [*] --> PENDING_EMAIL_CONFIRMATION: POST /register

    PENDING_EMAIL_CONFIRMATION --> ACTIVE: GET /confirm-email?token=
    PENDING_EMAIL_CONFIRMATION --> PENDING_EMAIL_CONFIRMATION: POST /resend-confirmation

    ACTIVE --> ACTIVE: POST /telegram/link + verify<br/>или POST /telegram/auth

    note right of PENDING_TELEGRAM_LINK
        Enum в схеме;
        явных переходов в коде нет
    end note

    note right of SUSPENDED
        Enum в схеме;
        проверка при login/Telegram
    end note

    ACTIVE --> [*]: DELETED (enum, админ-API нет)

    state TrustScore <<optional>> {
        [*] --> Stored: TrustScore в БД
        Stored --> Stored: POST /internal/trust-score/recalculate
    }
```

| Статус                           | Когда                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| `PENDING_EMAIL_CONFIRMATION`     | После `POST /register`                                        |
| `ACTIVE`                         | После подтверждения email, Telegram-auth или verify           |
| `PENDING_TELEGRAM_LINK`          | Зарезервирован в схеме                                        |
| `SUSPENDED`, `BANNED`, `DELETED` | Зарезервированы; `BANNED`/`SUSPENDED` блокируют Telegram-auth |

**Верификация личности** — отдельная сущность `IdentityVerification` (см. [Verification.md](Verification.md)), не путать со статусом `User`.
