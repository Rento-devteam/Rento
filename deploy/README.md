## Deploy (Docker Compose + Caddy)

### Setup

1) Create `deploy/.env` from template:

- Copy `deploy/.env.example` → `deploy/.env`
- Fill in secrets (JWT, BOT_SECRET, SMTP_PASS, S3 keys, etc.)

2) Set your DNS:

- Point `DOMAIN` (A/AAAA record) to your server IP
- Ensure ports `80` and `443` are open

### Run

From repo root:

- `docker compose -f deploy/docker-compose.yml up -d --build`

### Notes

- The frontend is served by `caddy` on `https://$DOMAIN/`. The API is available on `https://$DOMAIN/api/*` (Caddy strips `/api` and proxies to `backend:3000`).
- Only `caddy` publishes ports publicly (`80/443`). `postgres` and `elasticsearch` are internal-only.
- `DATABASE_URL` is built inside compose from `POSTGRES_*` and points to the `postgres` container.

