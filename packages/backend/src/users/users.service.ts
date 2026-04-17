import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import {
  buildDefaultTrustScore,
  buildUserProfileResponse,
  UserProfileResponse,
} from './user-profile.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async getCurrentUser(userId: string): Promise<UserProfileResponse> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return buildUserProfileResponse(user, buildDefaultTrustScore());
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

    return buildUserProfileResponse(user, buildDefaultTrustScore());
  }

  async getCurrentUserTrustScore(userId: string) {
    await this.ensureUserExists(userId);
    return buildDefaultTrustScore();
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
