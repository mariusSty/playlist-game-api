import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  upsertUser(id: string, name: string) {
    console.log('id', name);
    return this.prisma.user.upsert({
      where: {
        id,
      },
      update: {
        name,
      },
      create: {
        id,
        name,
      },
    });
  }
}
