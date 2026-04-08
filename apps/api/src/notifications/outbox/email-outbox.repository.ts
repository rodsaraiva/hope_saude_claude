import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface CreatePendingInput {
  to: string;
  subject: string;
  tag: string;
}

@Injectable()
export class EmailOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: CreatePendingInput): Promise<string> {
    const row = await this.prisma.emailOutbox.create({
      data: {
        to: input.to,
        subject: input.subject,
        tag: input.tag,
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
}
