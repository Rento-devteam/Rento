import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCardDto } from './dto/add-card.dto';
import { mapBankCard, mapBankCardList } from './payment-method.mapper';
import { PaymentGatewayStub } from './payment-gateway.stub';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayStub,
  ) {}

  async listMethods(userId: string) {
    const methods = await this.prisma.userPaymentMethod.findMany({
      where: { userId, status: PaymentMethodStatus.ATTACHED },
      orderBy: [{ isDefault: 'desc' }, { addedAt: 'asc' }],
    });

    return mapBankCardList(methods);
  }

  async addCard(userId: string, dto: AddCardDto) {
    const metadata = await this.gateway.verifyAndGetMetadata(dto.token);

    const existing = await this.prisma.userPaymentMethod.findUnique({
      where: { userId_token: { userId, token: dto.token } },
    });

    if (existing) {
      if (existing.status === PaymentMethodStatus.ATTACHED) {
        throw new ConflictException('This card is already attached to your account');
      }
      // Card was previously revoked/failed — re-attach it
      const reattached = await this.prisma.$transaction(async (tx) => {
        if (dto.setAsDefault) {
          await tx.userPaymentMethod.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.userPaymentMethod.update({
          where: { id: existing.id },
          data: {
            status: PaymentMethodStatus.ATTACHED,
            isDefault: dto.setAsDefault ?? false,
            last4: metadata.last4,
            cardType: metadata.cardType,
          },
        });
      });
      return mapBankCard(reattached);
    }

    const hasExistingCards = await this.prisma.userPaymentMethod.count({
      where: { userId, status: PaymentMethodStatus.ATTACHED },
    });

    // First card becomes default automatically
    const shouldBeDefault = dto.setAsDefault ?? hasExistingCards === 0;

    const saved = await this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.userPaymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.userPaymentMethod.create({
        data: {
          userId,
          token: dto.token,
          last4: metadata.last4,
          cardType: metadata.cardType,
          isDefault: shouldBeDefault,
          status: PaymentMethodStatus.ATTACHED,
        },
      });
    });

    return mapBankCard(saved);
  }

  async setDefault(userId: string, cardId: string) {
    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { id: cardId, userId, status: PaymentMethodStatus.ATTACHED },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPaymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      await tx.userPaymentMethod.update({
        where: { id: cardId },
        data: { isDefault: true },
      });
    });

    return mapBankCard({ ...method, isDefault: true });
  }

  async removeCard(userId: string, cardId: string) {
    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { id: cardId, userId, status: PaymentMethodStatus.ATTACHED },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPaymentMethod.update({
        where: { id: cardId },
        data: { status: PaymentMethodStatus.REVOKED, isDefault: false },
      });

      // If removed card was default, promote the oldest remaining card
      if (method.isDefault) {
        const next = await tx.userPaymentMethod.findFirst({
          where: { userId, status: PaymentMethodStatus.ATTACHED },
          orderBy: { addedAt: 'asc' },
        });
        if (next) {
          await tx.userPaymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }
}
