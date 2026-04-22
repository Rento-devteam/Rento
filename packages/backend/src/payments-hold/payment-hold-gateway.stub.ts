import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  PaymentHoldDeclinedError,
  type PaymentHoldGateway,
  type PaymentHoldAuthorizeRequest,
} from './payment-hold.gateway';

@Injectable()
export class PaymentHoldGatewayStub implements PaymentHoldGateway {
  private readonly logger = new Logger(PaymentHoldGatewayStub.name);

  async authorizeHold(request: PaymentHoldAuthorizeRequest) {
    this.logger.warn(
      'PaymentHoldGatewayStub: using stub gateway. Replace with a real provider before going to production.',
    );

    if (
      !request.paymentMethodToken ||
      request.paymentMethodToken.trim() === ''
    ) {
      throw new BadRequestException('Invalid payment method token');
    }
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    if (request.currency !== 'RUB') {
      throw new BadRequestException('Unsupported currency');
    }

    const token = request.paymentMethodToken.toLowerCase();
    if (token.includes('decline')) {
      throw new PaymentHoldDeclinedError(
        'Card was declined by issuer',
        'card_declined',
      );
    }
    if (token.includes('funds')) {
      throw new PaymentHoldDeclinedError(
        'Insufficient funds',
        'insufficient_funds',
      );
    }

    const stubBal = request.metadata?.stubBalanceRub;
    if (
      typeof stubBal === 'number' &&
      Number.isFinite(stubBal) &&
      stubBal < request.amount
    ) {
      throw new PaymentHoldDeclinedError(
        'Insufficient funds',
        'insufficient_funds',
      );
    }

    // Deterministic pseudo IDs for tests/dev.
    const hash = Array.from(request.idempotencyKey).reduce(
      (acc, ch) => (acc + ch.charCodeAt(0)) % 1_000_000,
      0,
    );

    return {
      holdId: `hold_${hash}`,
      authorizationCode: `auth_${String(hash).padStart(6, '0')}`,
    };
  }
}
