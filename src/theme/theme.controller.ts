import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Controller('theme')
export class ThemeController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findMany(@Query('limit', ParseIntPipe) limit: number) {
    return this.prisma.theme.findMany({
      take: limit,
    });
  }
}
