import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url: '/x', method: 'GET' }),
      }),
    } as unknown as ArgumentsHost;
  });

  const makeKnown = (code: string, meta?: Record<string, unknown>) => {
    const err = new Prisma.PrismaClientKnownRequestError('mock', {
      code,
      clientVersion: 'x',
      meta,
    });
    return err;
  };

  it('traduz P2025 (não encontrado) em 404', () => {
    filter.catch(makeKnown('P2025'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        code: 'P2025',
      }),
    );
  });

  it('traduz P2002 (unique constraint) em 409 com campo alvo', () => {
    filter.catch(makeKnown('P2002', { target: ['email'] }), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'P2002',
        message: expect.stringContaining('email'),
      }),
    );
  });

  it('traduz P2003 (foreign key violation) em 400', () => {
    filter.catch(makeKnown('P2003'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: 'P2003' }),
    );
  });

  it('códigos desconhecidos viram 500 genérico', () => {
    filter.catch(makeKnown('P9999'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, code: 'P9999' }),
    );
  });
});
