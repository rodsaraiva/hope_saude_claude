import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url: '/x', method: 'GET' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('preserva o status de uma HttpException (NotFound → 404)', () => {
    filter.catch(new NotFoundException('sumiu'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'sumiu',
        path: '/x',
      }),
    );
  });

  it('preserva mensagens de validação (array) da BadRequestException', () => {
    filter.catch(new BadRequestException(['email inválido', 'senha curta']), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['email inválido', 'senha curta'],
      }),
    );
  });

  it('Error cru vira 500 genérico SEM vazar stack nem mensagem interna', () => {
    filter.catch(new Error('SELECT * FROM users senha=123'), host);
    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload.statusCode).toBe(500);
    expect(payload.message).toBe('Erro interno do servidor.');
    expect(payload).not.toHaveProperty('stack');
    expect(JSON.stringify(payload)).not.toContain('SELECT');
  });

  it('inclui timestamp ISO e path da request', () => {
    filter.catch(new NotFoundException('x'), host);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload.path).toBe('/x');
    expect(typeof payload.timestamp).toBe('string');
    expect(() => new Date(payload.timestamp).toISOString()).not.toThrow();
  });
});
