import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error(
    'DATABASE_URL is required for integration tests. Copy .env.example to .env, run `docker compose up -d`, then `npx prisma migrate deploy`.',
  );
}
