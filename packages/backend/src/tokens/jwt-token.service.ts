import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../auth/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  sid?: string;
}

interface RedisRefreshSession {
  userId: string;
  tokenHash: string;
  createdAt: string;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async issueTokenPair(user: User): Promise<AuthTokenPair> {
    return this.issueTokenPairWithSession(user);
  }

  async refreshTokenPair(
    refreshToken: string,
  ): Promise<AuthTokenPair & { user: User }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    if (payload.sid && this.redisService.isReady) {
      const session = await this.redisService.get<RedisRefreshSession>(
        this.sessionKey(payload.sid),
      );
      if (
        !session ||
        session.userId !== payload.sub ||
        session.tokenHash !== tokenHash
      ) {
        throw new UnauthorizedException('Invalid refresh session');
      }

      const user = await this.loadActiveUser(payload.sub);
      await this.redisService.del(this.sessionKey(payload.sid));
      return { ...(await this.issueTokenPairWithSession(user)), user };
    }

    const stored = await this.prismaService.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prismaService.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.loadActiveUser(stored.userId);
    return { ...(await this.issueTokenPairWithSession(user)), user };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    if (payload.sid) {
      await this.redisService.del(this.sessionKey(payload.sid));
    }

    await this.prismaService.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPairWithSession(user: User): Promise<AuthTokenPair> {
    const sessionId = randomUUID();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        sid: sessionId,
        jti: randomUUID(),
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh', sid: sessionId },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    );

    const tokenHash = this.hashToken(refreshToken);
    await this.prismaService.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    await this.redisService.setJson(
      this.sessionKey(sessionId),
      {
        userId: user.id,
        tokenHash,
        createdAt: new Date().toISOString(),
      } satisfies RedisRefreshSession,
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<
        Partial<RefreshTokenPayload>
      >(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
      });
      if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return payload as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async loadActiveUser(userId: string): Promise<User> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }
    return user;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }
}
