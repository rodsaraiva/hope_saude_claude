import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma.service';

/**
 * Endpoint público de saúde da API.
 * Usado pelo Docker Swarm/Traefik para detectar instâncias quebradas.
 *
 * - 200 + status:'ok'  → instância saudável (banco respondendo)
 * - 503 + status:'error' → ao menos um indicador falhou (Terminus padrão)
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.pingDatabase()]);
  }

  private async pingDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err) {
      return {
        database: {
          status: 'down',
          message: err instanceof Error ? err.message : 'unknown error',
        },
      };
    }
  }
}
