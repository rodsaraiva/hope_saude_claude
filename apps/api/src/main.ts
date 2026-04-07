import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // CORS com whitelist via env (CORS_ORIGINS="http://a.com,http://b.com")
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove propriedades não declaradas nos DTOs
      forbidNonWhitelisted: true, // rejeita requests com propriedades extras (anti mass-assignment)
      transform: true, // converte tipos primitivos automaticamente
    }),
  );

  await app.listen(3000);
}
bootstrap();
