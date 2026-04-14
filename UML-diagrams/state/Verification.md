```mermaid
    stateDiagram-v2
    [*] --> Draft: Начало написания

    Draft --> Published: Опубликован
   
    state Published {
        [*] --> Visible
        Visible --> Reported: Получена жалоба
        Reported --> Hidden: FR-504: Скрыт модератором
        Reported --> Visible: Жалоба отклонена
    }
   
    Edited --> Published: Сохранено
   
    Published --> DeletedByAuthor: Удалён автором
    Hidden --> DeletedByModerator: FR-504: Удалён модератором
   
    DeletedByAuthor --> [*]
    DeletedByModerator --> [*]

```