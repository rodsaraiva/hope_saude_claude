import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response, Request } from 'express';

/**
 * Traduz erros conhecidos do Prisma em respostas HTTP adequadas.
 * Mantém a mensagem interna nos logs mas não vaza detalhes crus pro cliente.
 *
 * Mapeamento:
 *   P2025 — registro não encontrado → 404
 *   P2002 — violação de unique       → 409 (inclui campo alvo)
 *   P2003 — violação de FK           → 400
 *   P2014 — relação inválida         → 400
 *   outros → 500 com code
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.mapCode(exception);

    this.logger.warn(
      `Prisma ${exception.code} at ${request.method} ${request.url}: ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      error,
      code: exception.code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapCode(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Registro não encontrado.',
        };

      case 'P2002': {
        const target = (exception.meta as { target?: string[] | string } | undefined)?.target;
        const field = Array.isArray(target) ? target.join(', ') : (target ?? 'campo único');
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: `Já existe um registro com o mesmo valor em: ${field}.`,
        };
      }

      case 'P2003':
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Relacionamento inválido entre entidades.',
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Erro interno ao acessar o banco de dados.',
        };
    }
  }
}
