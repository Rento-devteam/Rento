import { Controller, Get } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('health')
export class RedisHealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get('redis')
  async getRedisHealth() {
    return this.redisService.ping();
  }
}
