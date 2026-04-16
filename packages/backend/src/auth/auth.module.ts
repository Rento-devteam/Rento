import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailModule } from '../email/email.module';
import { JwtTokenService } from '../tokens/jwt-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    EmailModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtTokenService, JwtAuthGuard],
})
export class AuthModule {}
