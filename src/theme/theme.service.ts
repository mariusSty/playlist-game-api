import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ThemeService {
  constructor(private prisma: PrismaService) {}

  listBase() {
    return this.prisma.client.theme.findMany({
      orderBy: { key: 'asc' },
    });
  }
}
