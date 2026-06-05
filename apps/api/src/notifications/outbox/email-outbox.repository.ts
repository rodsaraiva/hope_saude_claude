import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface CreatePendingInput {
  to: string;
  subject: string;
  tag: string;
}

export interface OutboxRow {
  id: string;
  to: string;
  subject: string;
  tag: string;
  status: string;
  attempts: number;
  failedAt: Date | null;
  payload: string | null;
}

export interface FindRetryableOptions {
  maxAttempts: number;
  now: Date;
  baseBackoffMs?: number;
}

@Injectable()
export class EmailOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: CreatePendingInput & { payload?: string }): Promise<string> {
    const row = await this.prisma.emailOutbox.create({
      data: {
        to: input.to,
        subject: input.subject,
        tag: input.tag,
        payload: input.payload ?? null,
        status: 'PENDING',
      },
      select: { id: true },
    });
    return row.id;
  }

  async markSent(id: string, providerMessageId: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: {
        status: 'SENT',
        providerMessageId,
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage,
        failedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async findManyByStatus(status: string): Promise<OutboxRow[]> {
    return this.prisma.emailOutbox.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
    }) as unknown as Promise<OutboxRow[]>;
  }

  /** Linhas elegíveis a (re)envio: PENDING ou FAILED com attempts < N e backoff vencido. */
  async findRetryable(options: FindRetryableOptions): Promise<OutboxRow[]> {
    const baseBackoffMs = options.baseBackoffMs ?? 60_000;
    const candidates = (await this.prisma.emailOutbox.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        attempts: { lt: options.maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
    })) as unknown as OutboxRow[];

    return candidates.filter((row) => {
      if (!row.failedAt) {
        return true;
      }
      const readyAt = row.failedAt.getTime() + baseBackoffMs * 2 ** row.attempts;
      return readyAt <= options.now.getTime();
    });
  }
}
