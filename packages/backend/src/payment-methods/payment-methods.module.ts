import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentGatewayStub } from './payment-gateway.stub';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService, PaymentGatewayStub],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
