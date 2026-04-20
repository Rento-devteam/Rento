import { type InjectionToken } from '@nestjs/common';

export type PaymentHoldAuthorizeRequest = {
  amount: number;
  currency: 'RUB';
  paymentMethodToken: string;
  idempotencyKey: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PaymentHoldAuthorizeResponse = {
  holdId: string;
  authorizationCode: string;
};

export type PaymentHoldDeclinedReason =
  | 'insufficient_funds'
  | 'card_declined'
  | 'invalid_payment_method';

export class PaymentHoldDeclinedError extends Error {
  readonly code = 'payment_declined' as const;
  constructor(
    message: string,
    public readonly reason: PaymentHoldDeclinedReason,
  ) {
    super(message);
  }
}

export interface PaymentHoldGateway {
  authorizeHold(
    request: PaymentHoldAuthorizeRequest,
  ): Promise<PaymentHoldAuthorizeResponse>;
}

export const PAYMENT_HOLD_GATEWAY: InjectionToken<PaymentHoldGateway> =
  'PAYMENT_HOLD_GATEWAY';
