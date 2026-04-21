import { Module } from '@nestjs/common';
import { PAYMENT_HOLD_GATEWAY } from './payment-hold.gateway';
import { PaymentHoldGatewayStub } from './payment-hold-gateway.stub';

@Module({
  providers: [
    PaymentHoldGatewayStub,
    { provide: PAYMENT_HOLD_GATEWAY, useExisting: PaymentHoldGatewayStub },
  ],
  exports: [PAYMENT_HOLD_GATEWAY],
})
export class PaymentsHoldModule {}
