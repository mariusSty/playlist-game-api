import { Injectable, OnModuleInit } from '@nestjs/common';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient } from './generated/prisma/client';

export type AcceleratedPrismaClient = ReturnType<
  typeof PrismaService.prototype.createClient
>;

@Injectable()
export class PrismaService implements OnModuleInit {
  readonly client = this.createClient();

  createClient() {
    return new PrismaClient({
      accelerateUrl: process.env.DATABASE_URL,
    }).$extends(withAccelerate());
  }

  async onModuleInit() {
    await this.client.$connect();
  }
}
