import { Controller, Get } from '@nestjs/common';
import { ThemeService } from './theme.service';

@Controller('theme')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get()
  findAll() {
    return this.themeService.listBase();
  }
}
