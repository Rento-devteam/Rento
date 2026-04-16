import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CompleteRegistrationQueryDto } from './dto/complete-registration-query.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { TelegramVerifyDto } from './dto/telegram-verify.dto';
import { BotSecretGuard } from './bot-secret.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('confirm-email')
  confirmEmail(@Query('token') token: string) {
    return this.authService.confirmEmail(token);
  }

  @Post('resend-confirmation')
  resendConfirmation(@Body() dto: ResendConfirmationDto) {
    return this.authService.resendConfirmation(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('complete-registration')
  completeRegistration(@Query() query: CompleteRegistrationQueryDto) {
    return this.authService.completeRegistration(query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('telegram/link')
  telegramLink(@Req() request: Request & { user?: { sub: string } }) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }

    return this.authService.generateTelegramLink(userId);
  }

  @Post('telegram/verify')
  telegramVerify(@Body() dto: TelegramVerifyDto) {
    return this.authService.verifyTelegram(dto);
  }

  @UseGuards(BotSecretGuard)
  @Post('telegram/auth')
  telegramAuth(@Body() dto: TelegramAuthDto) {
    return this.authService.telegramAuth(dto);
  }
}
