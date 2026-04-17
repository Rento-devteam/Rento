import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth/auth.service';
import { AuthUserStatus } from './auth/auth-status';
import { PrismaService } from './prisma/prisma.service';
import { EmailSenderStub } from './email/email-sender.stub';
import { JwtTokenService } from './tokens/jwt-token.service';

describe('AuthService', () => {
  let authService: AuthService;
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EmailSenderStub, useValue: emailSender },
        { provide: JwtTokenService, useValue: jwtTokenService },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it('returns pending email status from complete-registration', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'pending@example.com',
      status: AuthUserStatus.PENDING_EMAIL_CONFIRMATION,
    });

    const result = await authService.completeRegistration({
      email: 'pending@example.com',
    });

    expect(result.status).toBe('pending_email_confirmation');
    expect(result.nextStep).toBe('confirm_email');
  });
});
