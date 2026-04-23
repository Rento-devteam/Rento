import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  PaymentHoldDeclinedError,
  type PaymentHoldGateway,
  type PaymentHoldAuthorizeRequest,
  type PaymentHoldCaptureRentRequest,
  type PaymentHoldReleaseDepositRequest,
} from './payment-hold.gateway';

@Injectable()
export class PaymentHoldGatewayStub implements PaymentHoldGateway {
  private readonly logger = new Logger(PaymentHoldGatewayStub.name);
  private readonly operations = new Map<string, { operationId: string }>();

  authorizeHold(request: PaymentHoldAuthorizeRequest) {
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

    return Promise.resolve({
      holdId: `hold_${hash}`,
      authorizationCode: `auth_${String(hash).padStart(6, '0')}`,
    });
  }

  captureRent(request: PaymentHoldCaptureRentRequest) {
    return Promise.resolve(this.settlementOp('capture_rent', request));
  }

  releaseDeposit(request: PaymentHoldReleaseDepositRequest) {
    return Promise.resolve(this.settlementOp('release_deposit', request));
  }

  private settlementOp(
    kind: 'capture_rent' | 'release_deposit',
    request: {
      holdId: string;
      amount: number;
      currency: 'RUB';
      idempotencyKey: string;
    },
  ) {
    this.logger.warn(
      'PaymentHoldGatewayStub: using stub gateway. Replace with a real provider before going to production.',
    );

    if (!request.holdId || request.holdId.trim() === '') {
      throw new BadRequestException('Invalid holdId');
    }
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    if (request.currency !== 'RUB') {
      throw new BadRequestException('Unsupported currency');
    }
    if (!request.idempotencyKey || request.idempotencyKey.trim() === '') {
      throw new BadRequestException('Missing idempotencyKey');
    }

    const existing = this.operations.get(request.idempotencyKey);
    if (existing) {
      return existing;
    }

    // Allow deterministic failure injection for tests/dev.
    const key = request.idempotencyKey.toLowerCase();
    if (key.includes('fail')) {
      throw new PaymentHoldDeclinedError(
        `${kind} failed (stub)`,
        'card_declined',
      );
    }

    const hash = Array.from(
      `${kind}:${request.holdId}:${request.idempotencyKey}`,
    ).reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 1_000_000, 0);

    const res = { operationId: `${kind}_${String(hash).padStart(6, '0')}` };
    this.operations.set(request.idempotencyKey, res);
    return res;
  }
}
