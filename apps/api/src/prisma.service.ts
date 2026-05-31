import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // SQLite stopgap: WAL permite leituras concorrentes durante escrita;
    // busy_timeout evita SQLITE_BUSY imediato sob concorrência. Remover ao migrar p/ Postgres.
    // $queryRawUnsafe (não $executeRawUnsafe): estes PRAGMA retornam linha e o driver
    // SQLite do Prisma rejeita resultados em $executeRawUnsafe ("Execute returned results").
    await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    await this.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
