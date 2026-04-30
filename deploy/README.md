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

### GitHub Actions CD (production)

On push to `deploy`, CI must succeed first; then the **Deploy (production)** job runs SSH commands on the server: `git pull` in the clone and `docker compose -f deploy/docker-compose.yml up -d --build`.

Add repository secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret           | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `DEPLOY_HOST`    | Server hostname or IP                                     |
| `DEPLOY_USER`    | SSH user (must have access to the repo clone + Docker) |
| `DEPLOY_SSH_KEY` | Private key (pem); matching public key on the server     |
| `DEPLOY_SSH_KEY_B64` | Optional: base64 of private key (more robust for multiline secrets) |
| `DEPLOY_SSH_PASSPHRASE` | Passphrase for the private key, **exactly** as set at `ssh-keygen`. If the key has no passphrase, leave this secret empty or omit it. |
| `DEPLOY_PATH`    | Absolute path to this repo on the server               |

For GitHub Actions it is easiest to use a **deploy-only key with no passphrase** (then `DEPLOY_SSH_PASSPHRASE` is empty). If the key is encrypted, `DEPLOY_SSH_PASSPHRASE` must match byte-for-byte (no extra spaces or newlines).

On the server: clone the repo once into `DEPLOY_PATH`, create `deploy/.env`, and ensure the SSH user can run `docker compose`.
Keep the server clone on the `deploy` branch (`git checkout deploy` once).

### Notes

- The frontend is served by `caddy` on `https://$DOMAIN/`. The API is available on `https://$DOMAIN/api/*` (Caddy strips `/api` and proxies to `backend:3000`).
- Only `caddy` publishes ports publicly (`80/443`). `postgres` and `elasticsearch` are internal-only.
- `DATABASE_URL` is built inside compose from `POSTGRES_*` and points to the `postgres` container.

