import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TrustScoreService } from './trust-score.service';

@Controller('internal/trust-score')
export class InternalTrustScoreController {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  @Post('recalculate')
  recalculate(
    @Req() req: Request,
    @Body() body: { userId: string; eventType: string },
  ) {
    const expected = process.env.INTERNAL_API_SECRET;
    if (expected) {
      const provided = String(req.header('x-internal-secret') ?? '');
      if (provided !== expected) {
        throw new UnauthorizedException('Invalid internal secret');
      }
    }

    return this.trustScoreService.recalculateForUser({
      userId: body.userId,
      eventType: body.eventType,
    });
  }
}
