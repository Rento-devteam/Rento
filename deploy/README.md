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
- `docker compose -f deploy/docker-compose.yml run --rm backend npx prisma migrate deploy`

### GitHub Actions CD (production)

On push to `deploy`, CI must succeed first; then the **Deploy (production)** job runs SSH commands on the server:

1. Pull latest `deploy` branch
2. Rebuild/restart containers via docker compose
3. Apply Prisma migrations:
   - `docker compose -f deploy/docker-compose.yml run --rm backend npx prisma migrate deploy`

Required repository secrets (GitHub → Settings → Secrets and variables → Actions):

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_SSH_KEY` (or `DEPLOY_SSH_KEY_B64`)
- `DEPLOY_SSH_PASSPHRASE` (only if key is encrypted)

### Notes

- Only `caddy` publishes ports publicly (`80/443`). `postgres` and `elasticsearch` are internal-only.
- `DATABASE_URL` is built inside compose from `POSTGRES_*` and points to the `postgres` container.

