    classDiagram
    direction TB

    %% ==================== Базовые классы ====================
    class User {
        +UUID id
        +String email
        +String phone
        +String passwordHash
        +String fullName
        +DateTime createdAt
        +DateTime updatedAt
        +UserRole role
        +UserStatus status
        +register()
        +login()
        +updateProfile()
        +deleteAccount()
    }

    class UserVerification {
        +UUID id
        +UUID userId
        +VerificationType type
        +VerificationStatus status
        +String documentNumber
        +DateTime verifiedAt
        +DateTime expiresAt
        +verify()
        +reject()
    }

    class TrustScore {
        +UUID id
        +UUID userId
        +Float currentScore
        +Int totalDeals
        +Int successfulDeals
        +Int lateReturns
        +Int disputes
        +DateTime calculatedAt
        +calculate()
        +updateAfterDeal()
        +getHistory()
    }

    class BankCard {
        +UUID id
        +UUID userId
        +String token
        +String last4
        +String cardType
        +Boolean isDefault
        +DateTime addedAt
        +add()
        +remove()
        +setDefault()
    }

    class ChatMessage {
        +UUID id
        +UUID chatId
        +UUID senderId
        +String content
        +MessageType type
        +String mediaUrl
        +Boolean isRead
        +DateTime sentAt
        +Float fraudProbability
        +send()
        +markAsRead()
        +delete()
    }

    class Chat {
        +UUID id
        +UUID bookingId
        +UUID user1Id
        +UUID user2Id
        +ChatStatus status
        +DateTime createdAt
        +DateTime lastMessageAt
        +getMessages()
        +sendMessage()
        +close()
    }

    class Listing {
        +UUID id
        +UUID ownerId
        +UUID categoryId
        +String title
        +String description
        +Decimal pricePerDay
        +Decimal pricePerWeek
        +Decimal pricePerMonth
        +Decimal depositAmount
        +ListingStatus status
        +Float avgRating
        +DateTime createdAt
        +DateTime updatedAt
        +create()
        +update()
        +delete()
        +publish()
        +archive()
    }

    class ListingPhoto {
        +UUID id
        +UUID listingId
        +String url
        +String thumbnailUrl
        +Int order
        +Boolean isPrimary
        +DateTime uploadedAt
        +upload()
        +delete()
        +reorder()
    }

    class ListingAvailability {
        +UUID id
        +UUID listingId
        +Date date
        +AvailabilityStatus status
        +String reason
        +DateTime updatedAt
        +block()
        +unblock()
        +isAvailable()
    }

    class Category {
        +UUID id
        +String name
        +String slug
        +String icon
        +UUID parentId
        +Int order
        +Boolean isActive
        +getSubcategories()
        +getListings()
    }

    class Booking {
        +UUID id
        +UUID listingId
        +UUID renterId
        +UUID ownerId
        +Date startDate
        +Date endDate
        +Decimal rentAmount
        +Decimal depositAmount
        +Decimal totalAmount
        +BookingStatus status
        +DateTime createdAt
        +DateTime confirmedAt
        +DateTime startedAt
        +DateTime completedAt
        +create()
        +confirm()
        +cancel()
        +start()
        +complete()
        +dispute()
    }

    class BookingChecklist {
        +UUID id
        +UUID bookingId
        +ChecklistType type
        +DateTime createdAt
        +List~ChecklistItem~ items
        +submit()
        +verify()
    }

    class ChecklistItem {
        +UUID id
        +UUID checklistId
        +String description
        +String photoUrl
        +ItemCondition condition
        +String comment
        +addPhoto()
        +updateCondition()
    }

    class Transaction {
        +UUID id
        +UUID bookingId
        +UUID userId
        +TransactionType type
        +Decimal amount
        +TransactionStatus status
        +String paymentMethod
        +String externalId
        +DateTime createdAt
        +DateTime processedAt
        +process()
        +refund()
        +getStatus()
    }

    class EscrowHold {
        +UUID id
        +UUID transactionId
        +Decimal rentAmount
        +Decimal depositAmount
        +EscrowStatus status
        +DateTime heldAt
        +DateTime releaseAt
        +DateTime releasedAt
        +hold()
        +release()
        +extend()
    }

    class Dispute {
        +UUID id
        +UUID bookingId
        +UUID initiatorId
        +String reason
        +DisputeStatus status
        +UUID assignedModeratorId
        +DateTime createdAt
        +DateTime resolvedAt
        +String resolution
        +ResolutionType resolutionType
        +initiate()
        +assignModerator()
        +addEvidence()
        +resolve()
    }

    class DisputeEvidence {
        +UUID id
        +UUID disputeId
        +UUID uploadedById
        +EvidenceType type
        +String url
        +String description
        +DateTime uploadedAt
        +upload()
        +delete()
    }

    class Review {
        +UUID id
        +UUID bookingId
        +UUID authorId
        +UUID targetUserId
        +UUID listingId
        +Int rating
        +String comment
        +DateTime createdAt
        +Boolean isPublic
        +create()
        +update()
        +delete()
        +report()
    }

    class Favorite {
        +UUID id
        +UUID userId
        +UUID listingId
        +DateTime addedAt
        +add()
        +remove()
    }

    class SearchQuery {
        +UUID id
        +UUID userId
        +String query
        +JSON filters
        +DateTime searchedAt
        +save()
        +getHistory()
    }

    class Recommendation {
        +UUID id
        +UUID userId
        +UUID listingId
        +Float score
        +RecommendationType type
        +String reason
        +DateTime generatedAt
        +Boolean isViewed
        +Boolean isClicked
        +generate()
        +markViewed()
    }

    class Report {
        +UUID id
        +UUID reporterId
        +ReportTargetType targetType
        +UUID targetId
        +String reason
        +ReportStatus status
        +UUID assignedModeratorId
        +DateTime createdAt
        +DateTime processedAt
        +String moderatorNote
        +create()
        +assign()
        +process()
    }

    class ModerationLog {
        +UUID id
        +UUID moderatorId
        +ModerationAction action
        +String targetType
        +UUID targetId
        +String reason
        +JSON details
        +DateTime performedAt
        +log()
        +revert()
    }

    %% ==================== Enums ====================
    class UserRole {
        <<enumeration>>
        USER
        MODERATOR
        ADMIN
    }

    class UserStatus {
        <<enumeration>>
        ACTIVE
        SUSPENDED
        BANNED
        DELETED
    }

    class VerificationType {
        <<enumeration>>
        EMAIL
        PHONE
        TELEGRAM
        ESIA
        PASSPORT
    }

    class VerificationStatus {
        <<enumeration>>
        PENDING
        VERIFIED
        REJECTED
        EXPIRED
    }

    class ListingStatus {
        <<enumeration>>
        DRAFT
        PENDING_MODERATION
        ACTIVE
        ARCHIVED
        BLOCKED
    }

    class AvailabilityStatus {
        <<enumeration>>
        AVAILABLE
        BOOKED
        BLOCKED_BY_OWNER
        MAINTENANCE
    }

    class BookingStatus {
        <<enumeration>>
        PENDING
        CONFIRMED
        ACTIVE
        COMPLETED
        CANCELLED
        DISPUTED
    }

    class TransactionType {
        <<enumeration>>
        HOLD
        CAPTURE
        RELEASE
        REFUND
        PAYOUT
    }

    class TransactionStatus {
        <<enumeration>>
        PENDING
        PROCESSING
        SUCCESS
        FAILED
        REFUNDED
    }

    class EscrowStatus {
        <<enumeration>>
        HELD
        PARTIALLY_RELEASED
        FULLY_RELEASED
        REFUNDED
    }

    class DisputeStatus {
        <<enumeration>>
        OPEN
        UNDER_REVIEW
        RESOLVED_RENTER
        RESOLVED_OWNER
        RESOLVED_SPLIT
        CLOSED
    }

    class RecommendationType {
        <<enumeration>>
        SIMILAR
        BEST_CHOICE
        NEARBY
        TRENDING
        PERSONALIZED
    }

    %% ==================== Связи ====================
   
    %% User relations
    User "1" --> "0..*" UserVerification : has
    User "1" --> "1" TrustScore : has
    User "1" --> "0..*" BankCard : owns
    User "1" --> "0..*" Listing : creates
    User "1" --> "0..*" Booking : rents
    User "1" --> "0..*" Booking : owns_listing
    User "1" --> "0..*" Review : writes
    User "1" --> "0..*" Review : receives
    User "1" --> "0..*" Favorite : saves
    User "1" --> "0..*" SearchQuery : performs
    User "1" --> "0..*" Report : submits
    User "1" --> "0..*" Chat : participates_as_user1
    User "1" --> "0..*" Chat : participates_as_user2
   
    %% Moderator relations (наследование от User)
    User <|-- Moderator
    Moderator "1" --> "0..*" Dispute : resolves
    Moderator "1" --> "0..*" Report : processes
    Moderator "1" --> "0..*" ModerationLog : creates
   
    %% Listing relations
    Listing "1" --> "1" Category : belongs_to
    Listing "1" --> "0..*" ListingPhoto : contains
    Listing "1" --> "0..*" ListingAvailability : has_calendar
    Listing "1" --> "0..*" Booking : receives
    Listing "1" --> "0..*" Review : gets
    Listing "1" --> "0..*" Favorite : bookmarked_in
    Listing "1" --> "0..*" Recommendation : appears_in
   
    %% Category relations (самореференция для иерархии)
    Category "1" --> "0..*" Category : parent_of
   
    %% Booking relations
    Booking "1" --> "1" Listing : for
    Booking "1" --> "1" User : renter
    Booking "1" --> "1" User : owner
    Booking "1" --> "0..*" BookingChecklist : has
    Booking "1" --> "0..*" Transaction : generates
    Booking "1" --> "0..1" Dispute : may_have
    Booking "1" --> "0..1" Review : results_in
    Booking "1" --> "1" Chat : has
   
    %% Checklist relations
    BookingChecklist "1" --> "1..*" ChecklistItem : contains
   
    %% Transaction relations
    Transaction "1" --> "0..1" EscrowHold : creates
   
    %% Dispute relations
    Dispute "1" --> "0..*" DisputeEvidence : contains
   
    %% Recommendation relations
    User "1" --> "0..*" Recommendation : receives
    Recommendation "1" --> "1" Listing : recommends
   
    %% Report relations
    Report "1" --> "1" User : reported_by
    Report "0..1" --> "0..1" User : target_user
    Report "0..1" --> "0..1" Listing : target_listing
    Report "0..1" --> "0..1" Review : target_review
   
    %% Chat relations
    Chat "1" --> "0..*" ChatMessage : contains
