    stateDiagram-v2
    [*] --> Created: Пользователь отправляет жалобу

    Created --> Pending: В очереди
   
    state Pending {
        [*] --> Waiting
        Waiting --> Assigned: Назначен модератор
    }
   
    Pending --> Investigating: FR-504: Модератор начал проверку
   
    state Investigating {
        [*] --> GatheringInfo
        GatheringInfo --> Analyzing
        Analyzing --> DecisionPending
    }
   
    Investigating --> Resolved: Нарушение подтверждено
    Investigating --> Dismissed: Нарушение не найдено
   
    Resolved --> ActionTaken: FR-503/FR-504:<br/>Блокировка/удаление
    ActionTaken --> Closed
   
    Dismissed --> Closed
   
    Closed --> [*]
