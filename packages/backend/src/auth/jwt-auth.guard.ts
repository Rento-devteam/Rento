import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUserStatusValue } from './auth-status';

type AuthenticatedUserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export interface RequestWithUser extends Request {
  user?: {
    sub: string;
    email: string | null;
    role: AuthenticatedUserRole;
    status: AuthUserStatusValue;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.substring('Bearer '.length);
    try {
      request.user = (await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
      })) as RequestWithUser['user'];
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
