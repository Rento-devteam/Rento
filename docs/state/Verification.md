# IdentityVerification — верификация (ЕСИА)

**Источник:** модель `IdentityVerification`, enum `IdentityVerificationStatus`  
**Реализовано:** `POST /verify/esia/initiate`, `GET /verify/esia/callback`, stub для dev.

```mermaid
stateDiagram-v2
    [*] --> PENDING: POST /verify/esia/initiate

    PENDING --> VERIFIED: callback OK
    PENDING --> REJECTED: callback отказ
    PENDING --> EXPIRED: истёк срок

    VERIFIED --> EXPIRED: expiresAt прошёл
    VERIFIED --> PENDING: повторная initiate

    REJECTED --> PENDING: повторная попытка
    EXPIRED --> PENDING: повторная initiate

    VERIFIED --> [*]
    REJECTED --> [*]
```

Связь с пользователем: `User.identityVerification` (1:1). Бейдж «проверенный» на фронте зависит от `status === VERIFIED`.

Дополнительно: `POST /verify/esia/escalate` — эскалация сценария (см. контроллер).
