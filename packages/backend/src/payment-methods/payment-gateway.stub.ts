import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export interface CardMetadata {
  last4: string;
  cardType: string;
}

/**
 * Stub for the payment gateway integration.
 *
 * Replace this class (or provide a different implementation via DI token)
 * when integrating a real provider (YooKassa, CloudPayments, Stripe, etc.).
 *
 * Contract expected from a real gateway:
 *  - verifyAndGetMetadata: exchange a one-time front-token for persistent
 *    payment-method metadata (last4, brand). In real implementations this
 *    typically calls gateway.paymentMethods.create({ type: 'card', card: { token } }).
 */
@Injectable()
export class PaymentGatewayStub {
  private readonly logger = new Logger(PaymentGatewayStub.name);

  verifyAndGetMetadata(token: string): Promise<CardMetadata> {
    this.logger.warn(
      'PaymentGatewayStub: using stub gateway. Replace with a real provider before going to production.',
    );

    // Validate that the token at least looks like a non-empty string sent from the iframe.
    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Invalid payment token');
    }

    // In a real implementation the gateway SDK call would happen here and
    // would return the actual last4 and card brand from the payment method.
    // For the stub we derive a deterministic fake last4 from the token so
    // that different test tokens produce distinct cards.
    const hash = Array.from(token).reduce(
      (acc, ch) => acc + ch.charCodeAt(0),
      0,
    );
    const last4 = String(hash % 10000).padStart(4, '0');
    const cardType = hash % 2 === 0 ? 'Visa' : 'Mastercard';

    return Promise.resolve({ last4, cardType });
  }
}
