import { ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthUserStatus } from './auth-status';

describe('AuthService', () => {
  const prismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailConfirmationToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    telegramLinkCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const emailSender = {
    sendConfirmationEmail: jest.fn(),
  };

  const jwtTokenService = {
    issueTokenPair: jest.fn(),
  };

  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(
      prismaService as never,
      emailSender as never,
      jwtTokenService as never,
    );
  });

  it('throws conflict when email already exists', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
    });

    await expect(
      authService.register({
        email: 'user@example.com',
        password: 'StrongPass1!',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws bad request on weak password', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.register({
        email: 'new@example.com',
        password: 'weak',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws bad request on invalid telegram code', async () => {
    prismaService.telegramLinkCode.findFirst.mockResolvedValue(null);

    await expect(
      authService.verifyTelegram({
        code: 'BAD1',
        telegramId: 'tg_1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('activates user and returns token pair on telegram verify', async () => {
    const now = new Date();
    prismaService.telegramLinkCode.findFirst.mockResolvedValue({
      id: 'code-id',
      code: 'ABCD1234',
      userId: 'u1',
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      usedAt: null,
    });
    prismaService.user.findFirst.mockResolvedValue(null);
    prismaService.$transaction.mockResolvedValue(undefined);
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'active@example.com',
      fullName: null,
      phone: null,
      avatarUrl: null,
      role: 'USER',
      status: AuthUserStatus.ACTIVE,
    });
    jwtTokenService.issueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const response = await authService.verifyTelegram({
      code: 'ABCD1234',
      telegramId: 'telegram-100',
    });

    expect(response.accessToken).toBe('access-token');
    expect(response.refreshToken).toBe('refresh-token');
    expect(response.user.status).toBe(AuthUserStatus.ACTIVE);
    expect(response.user.role).toBe('USER');
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
  });

  it('activates account on email confirmation without telegram requirement', async () => {
    const now = new Date();
    prismaService.emailConfirmationToken.findFirst.mockResolvedValue({
      id: 'email-token-1',
      token: 'confirm-token',
      userId: 'u2',
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      usedAt: null,
      user: { id: 'u2' },
    });
    prismaService.$transaction.mockResolvedValue(undefined);
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u2',
      email: 'email-only@example.com',
      fullName: null,
      phone: null,
      avatarUrl: null,
      role: 'USER',
      status: AuthUserStatus.ACTIVE,
    });
    jwtTokenService.issueTokenPair.mockResolvedValue({
      accessToken: 'email-access-token',
      refreshToken: 'email-refresh-token',
    });

    const response = await authService.confirmEmail('confirm-token');

    expect(response.accessToken).toBe('email-access-token');
    expect(response.user.status).toBe(AuthUserStatus.ACTIVE);
    expect(response.user.fullName).toBeNull();
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: {
        emailConfirmedAt: expect.any(Date),
        status: AuthUserStatus.ACTIVE,
      },
    });
  });

  it('returns completed registration state for active account', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u3',
      email: 'active@example.com',
      status: AuthUserStatus.ACTIVE,
    });

    const result = await authService.completeRegistration({
      email: 'active@example.com',
    });

    expect(result).toEqual({
      status: 'completed',
      nextStep: null,
    });
  });
});
