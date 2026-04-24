import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalTrustScoreController } from './internal-trust-score.controller';
import { TrustScoreService } from './trust-score.service';

@Module({
  imports: [PrismaModule],
  controllers: [InternalTrustScoreController],
  providers: [TrustScoreService],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}

