import { Controller, Get, Put, Request, UseGuards, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(@Request() req, @Body() body) {
    return this.usersService.update(req.user.id, body);
  }

  @Get(':id')
  async getPublic(@Param('id') id: string) {
    const { password, ...rest } = await this.usersService.findById(id);
    return rest;
  }
}