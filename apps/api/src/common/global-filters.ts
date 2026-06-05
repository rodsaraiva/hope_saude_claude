import { ExceptionFilter } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * Filtros globais de exceção, na ordem em que devem ser registrados.
 * A ORDEM IMPORTA: o filtro específico do Prisma precisa ser avaliado antes
 * do catch-all (AllExceptionsFilter), senão um erro do Prisma (P2025/P2002/...)
 * cairia no catch-all e viraria 500 genérico em vez do status correto.
 * O teste em global-filters.spec.ts trava essa ordem.
 */
export function globalExceptionFilters(): ExceptionFilter[] {
  return [new AllExceptionsFilter(), new PrismaExceptionFilter()];
}
