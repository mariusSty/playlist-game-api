import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':userId/session')
  getSession(@Param('userId') userId: string) {
    return this.userService.getSession(userId);
  }
}
