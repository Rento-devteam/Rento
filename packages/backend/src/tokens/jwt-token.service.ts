import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHash } from 'crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../auth/auth.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async issueTokenPair(user: User): Promise<AuthTokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, status: user.status },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    );

    await this.prismaService.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
        ),
      },
    });

    return { accessToken, refreshToken };
  }
}
