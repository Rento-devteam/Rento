import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import {
  buildUserProfileResponse,
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

    const trustScore = await this.trustScoreService.getTrustScoreForUser(userId);
    return buildUserProfileResponse(user, trustScore);
  }

  async updateCurrentUser(
    userId: string,
    dto: UpdateCurrentUserDto,
  ): Promise<UserProfileResponse> {
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
      },
    });

    const trustScore = await this.trustScoreService.getTrustScoreForUser(userId);
    return buildUserProfileResponse(user, trustScore);
  }

  async getCurrentUserTrustScore(userId: string) {
    return this.trustScoreService.getTrustScoreForUser(userId);
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
}
