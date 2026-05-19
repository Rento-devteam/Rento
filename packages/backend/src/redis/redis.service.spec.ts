import { RedisService } from './redis.service';

describe('RedisService', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_URL;
  });

  afterAll(() => {
    process.env = env;
  });

  it('stays disabled by default', async () => {
    const service = new RedisService();

    await service.onModuleInit();

    await expect(service.ping()).resolves.toEqual({
      enabled: false,
      ok: true,
      status: 'disabled',
    });
  });

  it('does not throw when enabled without REDIS_URL', async () => {
    process.env.REDIS_ENABLED = 'true';
    const service = new RedisService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.ping()).resolves.toEqual({
      enabled: true,
      ok: false,
      status: 'not_initialized',
    });
  });
});
