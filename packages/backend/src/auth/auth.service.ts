import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  EMAIL_CONFIRMATION_TTL_HOURS,
  TELEGRAM_CODE_TTL_MINUTES,
} from './auth.constants';
import { CompleteRegistrationQueryDto } from './dto/complete-registration-query.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { TelegramVerifyDto } from './dto/telegram-verify.dto';
import { AuthUserStatus, AuthUserStatusValue } from './auth-status';
import { isStrongPassword } from './password-policy';
import { EmailSenderStub } from '../email/email-sender.stub';
import { PrismaService } from '../prisma/prisma.service';
import { JwtTokenService } from '../tokens/jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailSender: EmailSenderStub,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    userId: string;
    status: 'pending_confirmation';
    nextStep: 'confirm_email';
  }> {
    const email = dto.email.trim().toLowerCase();

    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match');
    }

    if (!isStrongPassword(dto.password)) {
      throw new BadRequestException(
        'Password must include uppercase, lowercase, number and special character',
      );
    }

    const existingUser = await this.prismaService.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prismaService.user.create({
      data: {
        email,
        passwordHash,
        status: AuthUserStatus.PENDING_EMAIL_CONFIRMATION,
      },
    });

    const token = await this.createEmailConfirmationToken(user.id);
    await this.emailSender.sendConfirmationEmail({
      email: email,
      confirmationUrl: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/confirm-email?token=${token}`,
    });

    return {
      userId: user.id,
      status: 'pending_confirmation',
      nextStep: 'confirm_email',
    };
  }

  async confirmEmail(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string | null; status: AuthUserStatusValue };
  }> {
    const tokenRow = await this.prismaService.emailConfirmationToken.findFirst({
      where: { token, usedAt: null },
      include: { user: true },
    });

    if (!tokenRow) {
      throw new BadRequestException('Invalid or used confirmation token');
    }

    if (tokenRow.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Confirmation token expired');
    }

    await this.prismaService.$transaction([
      this.prismaService.emailConfirmationToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: new Date() },
      }),
      this.prismaService.user.update({
        where: { id: tokenRow.userId },
        data: {
          emailConfirmedAt: new Date(),
          status: AuthUserStatus.ACTIVE,
        },
      }),
    ]);

    return this.issueAuthResponse(tokenRow.userId);
  }

  async resendConfirmation(dto: ResendConfirmationDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prismaService.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailConfirmedAt) {
      throw new ConflictException('Email is already confirmed');
    }

    const token = await this.createEmailConfirmationToken(user.id);
    await this.emailSender.sendConfirmationEmail({
      email: email,
      confirmationUrl: `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/confirm-email?token=${token}`,
    });

    return { message: 'Confirmation email resent' };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string | null; status: AuthUserStatusValue };
  }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prismaService.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== AuthUserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Account is not activated. Confirm email or Telegram.',
      );
    }

    return this.issueAuthResponse(user.id);
  }

  async completeRegistration(
    query: CompleteRegistrationQueryDto,
  ): Promise<{
    status:
      | 'completed'
      | 'pending_email_confirmation'
      | 'pending_telegram_link';
    nextStep: string | null;
  }> {
    const email = query.email.trim().toLowerCase();
    const user = await this.prismaService.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === AuthUserStatus.PENDING_EMAIL_CONFIRMATION) {
      return {
        status: 'pending_email_confirmation',
        nextStep: 'confirm_email',
      };
    }

    if (user.status === AuthUserStatus.PENDING_TELEGRAM_LINK) {
      return {
        status: 'pending_telegram_link',
        nextStep: 'link_telegram',
      };
    }

    return {
      status: 'completed',
      nextStep: null,
    };
  }

  async generateTelegramLink(
    userId: string,
  ): Promise<{ code: string; deepLink: string; qrCodeUrl: null }> {
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.emailConfirmedAt) {
      throw new ForbiddenException('Email confirmation is required before Telegram linking');
    }
    if (user.telegramId) {
      throw new ConflictException('Telegram account is already linked');
    }
    if (
      user.status === AuthUserStatus.BANNED ||
      user.status === AuthUserStatus.SUSPENDED ||
      user.status === AuthUserStatus.DELETED
    ) {
      throw new ForbiddenException('Telegram linking is unavailable for this account state');
    }

    const code = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + TELEGRAM_CODE_TTL_MINUTES * 60 * 1000);

    await this.prismaService.telegramLinkCode.create({
      data: {
        code,
        userId,
        expiresAt,
      },
    });

    const botBase = process.env.TELEGRAM_BOT_DEEPLINK_BASE ?? 'https://t.me/rento_bot?start=';
    return {
      code,
      deepLink: `${botBase}${code}`,
      qrCodeUrl: null,
    };
  }

  async verifyTelegram(
    dto: TelegramVerifyDto,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string | null; status: AuthUserStatusValue };
  }> {
    const codeRow = await this.prismaService.telegramLinkCode.findFirst({
      where: { code: dto.code.trim().toUpperCase(), usedAt: null },
    });
    if (!codeRow) {
      throw new BadRequestException('Invalid confirmation code');
    }

    if (codeRow.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Confirmation code expired');
    }

    const existingTelegram = await this.prismaService.user.findFirst({
      where: {
        telegramId: dto.telegramId,
        id: { not: codeRow.userId },
      },
    });
    if (existingTelegram) {
      throw new ConflictException('Telegram account already linked');
    }

    await this.prismaService.$transaction([
      this.prismaService.telegramLinkCode.update({
        where: { id: codeRow.id },
        data: { usedAt: new Date() },
      }),
      this.prismaService.user.update({
        where: { id: codeRow.userId },
        data: {
          telegramId: dto.telegramId,
          status: AuthUserStatus.ACTIVE,
        },
      }),
    ]);

    return this.issueAuthResponse(codeRow.userId);
  }

  async telegramAuth(dto: TelegramAuthDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string | null; status: AuthUserStatusValue };
  }> {
    let user = await this.prismaService.user.findFirst({
      where: { telegramId: dto.telegramId },
    });

    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          telegramId: dto.telegramId,
          status: AuthUserStatus.ACTIVE,
        },
      });
    }

    if (
      user.status === AuthUserStatus.BANNED ||
      user.status === AuthUserStatus.SUSPENDED ||
      user.status === AuthUserStatus.DELETED
    ) {
      throw new ForbiddenException('Account is not available');
    }

    return this.issueAuthResponse(user.id);
  }

  private async issueAuthResponse(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string | null; status: AuthUserStatusValue };
  }> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.jwtTokenService.issueTokenPair(user);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    };
  }

  private async createEmailConfirmationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_CONFIRMATION_TTL_HOURS * 60 * 60 * 1000);
    await this.prismaService.emailConfirmationToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
    return token;
  }
}
