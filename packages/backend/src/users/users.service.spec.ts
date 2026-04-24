import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    identityVerification: {
      findUnique: jest.fn(),
    },
  };

  const trustScoreService = {
    getTrustScoreForUser: jest.fn(),
  };

  let usersService: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    trustScoreService.getTrustScoreForUser.mockResolvedValue({
      currentScore: 0,
      totalDeals: 0,
      successfulDeals: 0,
      lateReturns: 0,
      disputes: 0,
      calculatedAt: new Date().toISOString(),
    });

    usersService = new UsersService(
      prismaService as never,
      trustScoreService as never,
    );
  });

  it('marks email user as not verified until email is confirmed', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      fullName: 'Rento User',
      phone: null,
      avatarUrl: null,
      role: 'USER',
      status: 'PENDING_EMAIL_CONFIRMATION',
      emailConfirmedAt: null,
    });

    const result = await usersService.getCurrentUser('u1');

    expect(result.isVerified).toBe(false);
  });

  it('returns current user profile with default trust score', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      fullName: 'Rento User',
      phone: '+79990000000',
      avatarUrl: 'https://example.com/avatar.png',
      role: 'USER',
      status: 'ACTIVE',
      emailConfirmedAt: new Date('2024-01-01'),
    });

    const result = await usersService.getCurrentUser('u1');

    expect(result).toMatchObject({
      id: 'u1',
      email: 'user@example.com',
      fullName: 'Rento User',
      role: 'USER',
      status: 'ACTIVE',
      isVerified: true,
    });
    expect(result.trustScore).toMatchObject({
      currentScore: 0,
      totalDeals: 0,
      successfulDeals: 0,
      lateReturns: 0,
      disputes: 0,
    });
  });

  it('normalizes empty profile fields to null on update', async () => {
    prismaService.user.update.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      fullName: null,
      phone: null,
      avatarUrl: null,
      role: 'USER',
      status: 'ACTIVE',
      emailConfirmedAt: new Date('2024-01-01'),
    });

    const result = await usersService.updateCurrentUser('u1', {
      fullName: '   ',
      phone: '  ',
      avatarUrl: '  ',
    });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        fullName: null,
        phone: null,
        avatarUrl: null,
      },
    });
    expect(result.fullName).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.avatarUrl).toBeNull();
  });

  it('throws when trust score is requested for missing user', async () => {
    trustScoreService.getTrustScoreForUser.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    await expect(
      usersService.getCurrentUserTrustScore('missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
