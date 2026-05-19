import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

export interface RedisStatus {
  enabled: boolean;
  ok: boolean;
  status: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly enabled =
    (process.env.REDIS_ENABLED ?? 'false').trim().toLowerCase() === 'true';
  private readonly url = process.env.REDIS_URL?.trim();
  private client: Redis | null = null;

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Redis disabled (REDIS_ENABLED is not true)');
      return;
    }

    if (!this.url) {
      this.logger.warn('Redis enabled but REDIS_URL is not set');
      return;
    }

    const keyPrefix = process.env.REDIS_KEY_PREFIX?.trim();
    this.client = new Redis(this.url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      keyPrefix: keyPrefix ? `${keyPrefix}:` : undefined,
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    try {
      await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis connected');
    } catch (err) {
      this.logger.warn(`Redis unavailable: ${String(err)}`);
    }
  }

  onModuleDestroy(): void {
    if (!this.client) {
      return;
    }

    this.client.disconnect();
    this.client = null;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isReady(): boolean {
    return this.client?.status === 'ready';
  }

  async ping(): Promise<RedisStatus> {
    if (!this.enabled) {
      return { enabled: false, ok: true, status: 'disabled' };
    }

    if (!this.client || !this.isReady) {
      return {
        enabled: true,
        ok: false,
        status: this.client?.status ?? 'not_initialized',
      };
    }

    try {
      const pong = await this.client.ping();
      return { enabled: true, ok: pong === 'PONG', status: this.client.status };
    } catch {
      return { enabled: true, ok: false, status: this.client.status };
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isReady) {
      return null;
    }

    const value = await this.client.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.client || !this.isReady) {
      return;
    }

    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isReady) {
      return;
    }

    await this.client.del(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    if (!this.client || !this.isReady) {
      return 0;
    }

    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }
}
