import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { globalExceptionFilters } from './global-filters';

@Controller('boom')
class BoomController {
  @Get('prisma')
  prisma(): never {
    throw new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
  }

  @Get('raw')
  raw(): never {
    throw new Error('SELECT * FROM users senha=123');
  }
}

describe('global exception filters (ordem)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(...globalExceptionFilters());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('erro do Prisma mantém o mapeamento específico (P2025 → 404 com code)', async () => {
    const res = await request(app.getHttpServer()).get('/boom/prisma');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('P2025');
    expect(res.body.statusCode).toBe(404);
  });

  it('Error cru cai no catch-all (500 genérico, sem vazar a query)', async () => {
    const res = await request(app.getHttpServer()).get('/boom/raw');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erro interno do servidor.');
    expect(JSON.stringify(res.body)).not.toContain('SELECT');
  });
});
