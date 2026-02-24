import { Injectable, OnModuleInit } from '@nestjs/common';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaClient } from './generated/prisma/client';

const basePrisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate());

export type AcceleratedPrismaClient = typeof basePrisma;

@Injectable()
export class PrismaService implements OnModuleInit {
  readonly client: AcceleratedPrismaClient = basePrisma;

  async onModuleInit() {
    await this.client.$connect();
  }
}
