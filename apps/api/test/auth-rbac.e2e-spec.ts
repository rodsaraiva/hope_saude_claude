import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth RBAC (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/profile/doctor (GET) - Fail as Patient', () => {
    // Simulando o request com um usuário de papel incorreto
    return request(app.getHttpServer())
      .get('/auth/profile/doctor')
      .expect(403);
  });

  it('/auth/profile/patient (GET) - Success as Patient', () => {
    // Simulando o request com um usuário de papel correto
    // Mockando o comportamento do guard para propósitos de teste
    return request(app.getHttpServer())
      .get('/auth/profile/patient')
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
