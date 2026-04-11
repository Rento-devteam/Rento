    stateDiagram-v2
    [*] --> Pending: FR-301/FR-303:<br/>Отклик на объявление

    state Pending {
        [*] --> WaitingOwner
        WaitingOwner --> OwnerApproved: Владелец подтвердил
        WaitingOwner --> OwnerRejected: Владелец отказал
        OwnerRejected --> [*]: Бронь отменена
    }
    
    Pending --> Confirmed: Подтверждено
    
    state Confirmed {
        [*] --> WaitingPayment
        WaitingPayment --> PaymentHeld: FR-401: Средства заблокированы
        PaymentHeld --> ReadyForHandover
    }
    
    Confirmed --> Active: FR-403: Фотофиксация<br/>при передаче
    
    state Active {
        [*] --> InProgress
        InProgress --> NearingEnd: Приближается конец
        InProgress --> Overdue: Просрочка
    }
    
    Active --> Completed: FR-403: Фотофиксация<br/>при возврате +<br/>FR-402: Взаимное подтверждение
    
    state Completed {
        [*] --> WaitingRelease
        WaitingRelease --> FundsReleased: FR-404: Залог возвращён
        FundsReleased --> ReviewPending
        ReviewPending --> ReviewDone: Оставлен отзыв
    }
    
    Completed --> [*]
    
    Pending --> Cancelled: Отмена арендатором
    Confirmed --> Cancelled: Отмена до передачи
    Active --> Disputed: FR-502: Инициирован спор
    
    state Disputed {
        [*] --> UnderModeration
        UnderModeration --> ResolvedRenter: В пользу арендатора
        UnderModeration --> ResolvedOwner: В пользу владельца
        UnderModeration --> ResolvedSplit: Разделение
    }
    
    Disputed --> Completed: Спор разрешён
    Disputed --> Cancelled: Спор → отмена
