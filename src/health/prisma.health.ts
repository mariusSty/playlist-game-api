import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.prisma.client.user.findFirst({ select: { id: true } });
      return indicator.up();
    } catch (error) {
      Sentry.logger.error('Database health check failed', { error: error.message });
      return indicator.down({ message: error.message });
    }
  }
}
