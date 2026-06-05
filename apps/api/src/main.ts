import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors.util';
import { globalExceptionFilters } from './common/global-filters';
import { registerProcessHandlers } from './observability/bootstrap-handlers';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Pino estruturado como logger global (substitui o Logger padrão do Nest)
  const logger = app.get(Logger);
  app.useLogger(logger);
  registerProcessHandlers(logger);

  // Security headers
  app.use(helmet());

  // CORS com whitelist via env (CORS_ORIGINS="http://a.com,http://b.com")
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove propriedades não declaradas nos DTOs
      forbidNonWhitelisted: true, // rejeita requests com propriedades extras (anti mass-assignment)
      transform: true, // converte tipos primitivos automaticamente
    }),
  );

  // Filtros globais de exceção — ordem travada por global-filters.spec.ts
  app.useGlobalFilters(...globalExceptionFilters());

  // Garante onModuleDestroy (PrismaService.$disconnect) em SIGTERM/SIGINT (Swarm)
  app.enableShutdownHooks();

  // OpenAPI / Swagger UI em /api/docs (apenas em dev por padrão)
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Hope Saúde API')
      .setDescription('API da plataforma de telepsiquiatria Hope Saúde')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'JWT',
      )
      .addTag('auth', 'Cadastro, login, sessão')
      .addTag('profile', 'Perfis de médico e paciente')
      .addTag('appointment', 'Consultas')
      .addTag('payment', 'Checkout Asaas (PIX/cartão)')
      .addTag('medical-record', 'Prontuários')
      .addTag('prescription', 'Receitas')
      .addTag('video', 'Token LiveKit')
      .addTag('health', 'Health check')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(3000);
}
bootstrap();
