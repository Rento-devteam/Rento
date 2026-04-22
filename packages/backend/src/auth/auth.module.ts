import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BotSecretGuard } from './bot-secret.guard';
import { EmailModule } from '../email/email.module';
import { JwtTokenService } from '../tokens/jwt-token.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [EmailModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtTokenService, JwtAuthGuard, OptionalJwtAuthGuard, BotSecretGuard],
  exports: [JwtModule, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
