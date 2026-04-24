import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { EsiaStubVerificationProvider } from './providers/esia-stub.provider';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    {
      provide: 'IdentityVerificationProvider',
      useClass: EsiaStubVerificationProvider,
    },
  ],
  exports: [VerificationService],
})
export class VerificationModule {}

