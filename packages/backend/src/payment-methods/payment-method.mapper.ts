import { PaymentMethodStatus } from '@prisma/client';

type PaymentMethodRecord = {
  id: string;
  last4: string;
  cardType: string;
  isDefault: boolean;
  status: PaymentMethodStatus;
  addedAt: Date;
};

export function mapBankCard(method: PaymentMethodRecord) {
  return {
    id: method.id,
    last4: method.last4,
    cardType: method.cardType,
    isDefault: method.isDefault,
    addedAt: method.addedAt.toISOString(),
  };
}

export function mapBankCardList(methods: PaymentMethodRecord[]) {
  return {
    items: methods.map(mapBankCard),
  };
}
