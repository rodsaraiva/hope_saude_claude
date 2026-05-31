import { Test } from '@nestjs/testing';
import { HealthCheckService, HealthIndicatorFunction } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    healthCheckService = {
      check: jest.fn().mockImplementation(async (indicators: HealthIndicatorFunction[]) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        return { status: 'ok', info: Object.assign({}, ...results), details: {}, error: {} };
      }),
    };
    prisma = { $queryRaw: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('GET /health invoca o HealthCheckService.check', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await controller.check();

    expect(healthCheckService.check).toHaveBeenCalledTimes(1);
  });

  it('inclui um ping ao banco como indicador', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result.info).toHaveProperty('database');
    expect(result.status).toBe('ok');
  });

  it('marca database como down quando o ping falha', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await controller.check();

    expect(result.info?.database?.status).toBe('down');
  });
});
