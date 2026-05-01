import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import {
  buildUserProfileResponse,
  computeUserIsVerified,
  type TrustScoreSnapshot,
  UserProfileResponse,
} from './user-profile.mapper';
import { TrustScoreService } from '../trust-score/trust-score.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  async getCurrentUser(userId: string): Promise<UserProfileResponse> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const trustScore =
      await this.trustScoreService.getTrustScoreForUser(userId);
    return buildUserProfileResponse(user, trustScore);
  }

  async getPublicUserProfile(userId: string): Promise<{
    id: string;
    email: string | null;
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    role: 'USER' | 'MODERATOR' | 'ADMIN';
    status: UserStatus;
    isVerified: boolean;
    trustScore?: TrustScoreSnapshot;
  }> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailConfirmedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const trustScore =
      await this.trustScoreService.getTrustScoreForUser(userId);
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: user.fullName ?? null,
      phone: user.phone ?? null,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      status: user.status,
      isVerified: computeUserIsVerified({
        email: user.email,
        emailConfirmedAt: user.emailConfirmedAt ?? null,
        status: user.status,
      }),
      ...(trustScore ? { trustScore } : {}),
    };
  }

  async updateCurrentUser(
    userId: string,
    dto: UpdateCurrentUserDto,
  ): Promise<UserProfileResponse> {
    const coordsUpdate = this.resolveAddressCoordinatesUpdate(dto);

    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined
          ? { fullName: this.normalizeOptionalString(dto.fullName) }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: this.normalizeOptionalString(dto.phone) }
          : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: this.normalizeOptionalString(dto.avatarUrl) }
          : {}),
        ...(dto.addressText !== undefined
          ? {
              addressText:
                dto.addressText.trim().length > 0
                  ? dto.addressText.trim()
                  : null,
            }
          : {}),
        ...(coordsUpdate ? coordsUpdate : {}),
      },
    });

    const trustScore =
      await this.trustScoreService.getTrustScoreForUser(userId);
    return buildUserProfileResponse(user, trustScore);
  }

  async getCurrentUserTrustScore(userId: string) {
    return this.trustScoreService.getTrustScoreForUser(userId);
  }

  async recalculateTrustScore(params: { userId: string; eventType: string }) {
    return this.trustScoreService.recalculateForUser(params);
  }

  async assertUserCanCreateListing(userId: string): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not allowed to create listings');
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private normalizeOptionalString(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private resolveAddressCoordinatesUpdate(
    dto: UpdateCurrentUserDto,
  ):
    | { addressLatitude: null; addressLongitude: null }
    | { addressLatitude: number; addressLongitude: number }
    | undefined {
    const latDefined = dto.addressLatitude !== undefined;
    const lonDefined = dto.addressLongitude !== undefined;
    if (!latDefined && !lonDefined) {
      return undefined;
    }
    if (latDefined !== lonDefined) {
      throw new BadRequestException(
        'Укажите пару координат: addressLatitude и addressLongitude вместе (или ни одной)',
      );
    }
    const latNull = dto.addressLatitude === null;
    const lonNull = dto.addressLongitude === null;
    if (latNull || lonNull) {
      if (!latNull || !lonNull) {
        throw new BadRequestException(
          'Очистка координат: отправьте null для latitude и longitude вместе',
        );
      }
      return {
        addressLatitude: null,
        addressLongitude: null,
      };
    }
    const lat = dto.addressLatitude;
    const lon = dto.addressLongitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new BadRequestException('Некорректные координаты профиля');
    }
    return {
      addressLatitude: lat,
      addressLongitude: lon,
    };
  }
}
