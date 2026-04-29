import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { EsiaCallbackQueryDto } from './dto/esia-callback-query.dto';
import { VerificationService } from './verification.service';
import { UsersService } from '../users/users.service';
import { IdentityVerificationStatus } from '@prisma/client';

@Controller('verify/esia')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@Req() request: RequestWithUser) {
    return this.verificationService.initiateEsiaVerification(
      this.getUserId(request),
    );
  }

  @Get('callback')
  async callback(@Query() query: EsiaCallbackQueryDto) {
    const result = await this.verificationService.handleEsiaCallback({
      attemptId: query.attemptId,
      code: query.code,
      error: query.error,
    });

    if (result.status === IdentityVerificationStatus.VERIFIED) {
      await this.usersService.recalculateTrustScore({
        userId: result.userId,
        eventType: 'identity_verified',
      });
    }

    const trustScore = await this.usersService.getCurrentUserTrustScore(
      result.userId,
    );
    return { status: result.status, message: result.message, trustScore };
  }

  @UseGuards(JwtAuthGuard)
  @Post('escalate')
  @HttpCode(202)
  escalate(
    @Req() request: RequestWithUser,
    @Body() body: { reason: string; comment?: string },
  ) {
    return this.verificationService.escalateEsiaVerification({
      userId: this.getUserId(request),
      reason: body.reason,
      comment: body.comment,
    });
  }

  /**
   * Stub endpoint used by EsiaStubVerificationProvider.
   * Simulates ESIA decision and redirects back to callback.
   */
  @Get('stub')
  stubRedirect(
    @Res() res: Response,
    @Query('attemptId') attemptId?: string,
    @Query('deny') deny?: string,
  ) {
    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const callbackUrl = new URL('/verify/esia/callback', baseUrl);
    if (attemptId) {
      callbackUrl.searchParams.set('attemptId', attemptId);
    }

    if (deny === '1') {
      callbackUrl.searchParams.set('error', 'access_denied');
    } else {
      callbackUrl.searchParams.set('code', 'stub_code');
    }

    // Keep flow consistent: callback is still authorized by JWT.
    res.redirect(callbackUrl.toString());
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return userId;
  }
}
