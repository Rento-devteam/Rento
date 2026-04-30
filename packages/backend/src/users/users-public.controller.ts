import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersPublicController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':userId/public')
  getPublicUserProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.getPublicUserProfile(userId);
  }
}

