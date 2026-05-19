# Доменная модель (классы / Prisma)

Диаграмма отражает **модели в Prisma**. Методы `+create()` и т.п. — логические операции сервисов, не методы ORM.

```mermaid
classDiagram
    direction TB

    class User {
        +UUID id
        +String email
        +String passwordHash
        +String fullName
        +String telegramId
        +UserRole role
        +UserStatus status
        +DateTime emailConfirmedAt
    }

    class IdentityVerification {
        +UUID id
        +UUID userId
        +String provider
        +IdentityVerificationStatus status
        +DateTime verifiedAt
    }

    class TrustScore {
        +UUID id
        +UUID userId
        +Int currentScore
        +Int totalDeals
        +DateTime calculatedAt
    }

    class Category {
        +UUID id
        +String name
        +String slug
        +Int order
        +Boolean isActive
    }

    class Listing {
        +UUID id
        +UUID ownerId
        +UUID categoryId
        +String title
        +String description
        +Float rentalPrice
        +RentalPeriod rentalPeriod
        +Float depositAmount
        +ListingStatus status
        +ListingTextModerationStatus moderationStatus
    }

    class ListingPhoto {
        +UUID id
        +UUID listingId
        +String url
        +Int order
    }

    class ListingManualCalendarBlock {
        +UUID id
        +UUID listingId
        +Date startDate
        +Date endDate
    }

    class Booking {
        +UUID id
        +UUID listingId
        +UUID renterId
        +Date startDate
        +Date endDate
        +Float totalAmount
        +BookingStatus status
        +BookingSettlementStatus settlementStatus
        +String paymentHoldId
    }

    class UserPaymentMethod {
        +UUID id
        +UUID userId
        +String token
        +String last4
        +PaymentMethodStatus status
    }

    User "1" --> "*" Listing : owns
    User "1" --> "*" Booking : rents
    User "1" --> "0..1" IdentityVerification
    User "1" --> "0..1" TrustScore
    User "1" --> "*" UserPaymentMethod

    Category "1" --> "*" Listing
    Listing "1" --> "*" ListingPhoto
    Listing "1" --> "*" ListingManualCalendarBlock
    Listing "1" --> "*" Booking

    note for Listing
        Публикация: DRAFT → ACTIVE
        после text moderation (allow)
    end note

    note for Booking
        PENDING_PAYMENT → CONFIRMED
        → COMPLETED (return confirm)
    end note
```

## Запланировано (нет в Prisma)

`Chat`, `ChatMessage`, `Review`, `Report`, `Dispute`, `Transaction` (отдельная таблица), `Recommendation` — см. ТЗ и [ClassLogic.md](ClassLogic.md).

## Сервисы NestJS (реализация)

| Модель       | Сервис                                                      |
| ------------ | ----------------------------------------------------------- |
| User, auth   | `AuthService`, `UsersService`                               |
| Listing      | `ListingsService`                                           |
| Booking      | `BookingsWorkflowService`                                   |
| Search index | `ListingSearchIndexService`, `SearchService`                |
| Moderation   | `ModerationService`, `RulesEngine`, `LlamaModerationClient` |
| Calendar     | `CalendarService`                                           |
