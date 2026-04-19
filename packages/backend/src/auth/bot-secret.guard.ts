import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class BotSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.BOT_SECRET;
    if (!expected) {
      throw new UnauthorizedException('BOT_SECRET is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-bot-secret'];

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid bot secret');
    }

    return true;
  }
}
