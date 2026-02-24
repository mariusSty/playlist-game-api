import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DIRECT_DATABASE_URL });
const adapter = new PrismaPg(pool);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
