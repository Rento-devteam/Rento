import { Global, Module } from '@nestjs/common';
import { RedisHealthController } from './redis-health.controller';
import { RedisService } from './redis.service';

@Global()
@Module({
  controllers: [RedisHealthController],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
