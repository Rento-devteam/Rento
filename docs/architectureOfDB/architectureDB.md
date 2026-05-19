# Архитектура БД (PostgreSQL)

**Источник:** `packages/backend/prisma/schema.prisma`  
Идентификаторы — **UUID** (`String @id @default(uuid())`).

```mermaid
erDiagram
    User ||--o{ Listing : owns
    User ||--o{ Booking : rents
    User ||--o| IdentityVerification : has
    User ||--o| TrustScore : has
    User ||--o{ UserPaymentMethod : has
    User ||--o{ RefreshToken : has
    User ||--o{ EmailConfirmationToken : has
    User ||--o{ TelegramLinkCode : has
    User ||--o{ TelegramLoginExchangeCode : has

    Category ||--o{ Listing : categorizes
    Listing ||--o{ ListingPhoto : has
    Listing ||--o{ ListingManualCalendarBlock : blocks
    Listing ||--o{ Booking : receives

    TelegramLoginAttempt ||--o{ TelegramLoginExchangeCode : issues

    User {
        uuid id PK
        string email UK
        string passwordHash
        string fullName
        string phone
        string avatarUrl
        string addressText
        float addressLatitude
        float addressLongitude
        enum role
        enum status
        datetime emailConfirmedAt
        string telegramId UK
        datetime createdAt
        datetime updatedAt
    }

    IdentityVerification {
        uuid id PK
        uuid userId FK UK
        string provider
        enum status
        datetime verifiedAt
        datetime expiresAt
        string lastError
    }

    TrustScore {
        uuid id PK
        uuid userId FK UK
        int currentScore
        int totalDeals
        int successfulDeals
        int lateReturns
        int disputes
        datetime calculatedAt
    }

    Category {
        uuid id PK
        string name
        string slug UK
        string icon
        int order
        boolean isActive
    }

    Listing {
        uuid id PK
        uuid ownerId FK
        uuid categoryId FK
        string title
        string description
        float rentalPrice
        enum rentalPeriod
        float depositAmount
        enum status
        string addressText
        float latitude
        float longitude
        enum moderationStatus
        json moderationReasons
        int moderationVersion
        float moderationConfidence
    }

    ListingPhoto {
        uuid id PK
        uuid listingId FK
        string url
        string thumbnailUrl
        int order
        boolean isPrimary
    }

    ListingManualCalendarBlock {
        uuid id PK
        uuid listingId FK
        date startDate
        date endDate
        string reason
    }

    Booking {
        uuid id PK
        uuid listingId FK
        uuid renterId FK
        date startDate
        date endDate
        datetime startAt
        datetime endAt
        float rentAmount
        float depositAmount
        float totalAmount
        float amountHeld
        string paymentHoldId
        enum status
        enum settlementStatus
        datetime returnRenterConfirmedAt
        datetime returnLandlordConfirmedAt
        datetime returnMutualConfirmedAt
        datetime completedAt
    }

    UserPaymentMethod {
        uuid id PK
        uuid userId FK
        string token
        string last4
        string cardType
        boolean isDefault
        enum status
    }
```

## Календарь доступности

Отдельной таблицы «слотов» нет. Занятость вычисляется из:

1. **`Booking`** — статусы, блокирующие даты (см. [state/Booking.md](../state/Booking.md));
2. **`ListingManualCalendarBlock`** — ручные блоки владельца.

## Вне PostgreSQL

| Хранилище         | Данные                                                  |
| ----------------- | ------------------------------------------------------- |
| **Elasticsearch** | Индекс `rento-listings` — поиск по активным объявлениям |
| **S3**            | Файлы `ListingPhoto.url`                                |
| **Ollama**        | Не в БД; вызовы модерации по HTTP                       |

## Категории (production)

Справочник `Category`: «Для ремонта», «Для детей», «Для авто», «Для дома», «Для питомцев», «Для хобби», «Разное» (slug: `dlya-remonta` … `raznoe`).
