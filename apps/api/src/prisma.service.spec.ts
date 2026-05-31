import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('aplica PRAGMA journal_mode=WAL e busy_timeout no onModuleInit', async () => {
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    // $queryRawUnsafe (não $executeRawUnsafe): os PRAGMA retornam linha e o driver
    // SQLite do Prisma rejeita resultados em $executeRawUnsafe.
    const execSpy = jest
      .spyOn(service, '$queryRawUnsafe')
      .mockResolvedValue([] as unknown as unknown[]);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(execSpy).toHaveBeenCalledWith('PRAGMA journal_mode=WAL;');
    expect(execSpy).toHaveBeenCalledWith('PRAGMA busy_timeout=5000;');
  });

  it('onModuleDestroy chama $disconnect', async () => {
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
