import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { UsersController } from './users.controller';
import { UsersPublicController } from './users-public.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, TrustScoreModule],
  controllers: [UsersController, UsersPublicController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
