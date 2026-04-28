import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalTrustScoreController } from './internal-trust-score.controller';
import { TrustScoreService } from './trust-score.service';
import { TrustScoreRecalculateJob } from './trust-score-recalculate.job';

@Module({
  imports: [PrismaModule],
  controllers: [InternalTrustScoreController],
  providers: [TrustScoreService, TrustScoreRecalculateJob],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}
