import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getCurrentUser(@Req() request: RequestWithUser) {
    return this.usersService.getCurrentUser(this.getUserId(request));
  }

  @Patch('me')
  updateCurrentUser(
    @Req() request: RequestWithUser,
    @Body() dto: UpdateCurrentUserDto,
  ) {
    return this.usersService.updateCurrentUser(this.getUserId(request), dto);
  }

  @Get('me/trust-score')
  getCurrentUserTrustScore(@Req() request: RequestWithUser) {
    return this.usersService.getCurrentUserTrustScore(this.getUserId(request));
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }

    return userId;
  }
}
