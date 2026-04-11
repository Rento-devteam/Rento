    stateDiagram-v2
    [*] --> Created: Booking.confirm()

    Created --> ProcessingHold: Запрос в платёжный шлюз
   
    state ProcessingHold {
        [*] --> Authorizing
        Authorizing --> Holding: FR-401: Блокировка средств
        Authorizing --> Failed: Недостаточно средств
    }
   
    ProcessingHold --> Held: Средства заблокированы
    ProcessingHold --> Failed: Ошибка блокировки
   
    state Held {
        [*] --> RentHeld
        [*] --> DepositHeld
        RentHeld --> WaitingCompletion
        DepositHeld --> WaitingCompletion
    }
   
    Held --> PartialRelease: Частичное освобождение
   
    Held --> FullRelease: FR-402/FR-404:<br/>Взаимное подтверждение + 24ч
   
    state FullRelease {
        [*] --> CaptureRent: Аренда → владельцу
        [*] --> ReleaseDeposit: Залог → арендатору
        CaptureRent --> AllDone
        ReleaseDeposit --> AllDone
    }
   
    FullRelease --> Completed
   
    Held --> Refunded: Спор → возврат арендатору
   
    Failed --> [*]
    Completed --> [*]
    Refunded --> [*]
