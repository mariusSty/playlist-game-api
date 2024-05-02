import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateThemeDto } from 'src/theme/dto/create-theme.dto';

@Controller('theme')
export class ThemeController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findMany(@Query('limit', ParseIntPipe) limit: number) {
    return this.prisma.theme.findMany({
      take: limit,
    });
  }

  @Post()
  create(@Body() createThemeDto: CreateThemeDto) {
    return this.prisma.theme.create({
      data: {
        description: createThemeDto.description,
        isCreatedByUser: true,
      },
    });
  }
}
