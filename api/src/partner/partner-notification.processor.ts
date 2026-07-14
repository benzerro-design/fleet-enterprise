import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerMailService } from './partner-mail.service';

const BATCH = 20;
const INTERVAL_MS = 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PartnerNotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PartnerNotificationProcessor.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: PartnerMailService,
  ) {}

  onModuleInit() {
    if (!this.mail.isConfigured()) {
      this.logger.warn('SMTP not configured — partner outbox will persist only (set SMTP_HOST, SMTP_FROM)');
      return;
    }
    void this.processPending();
    this.timer = setInterval(() => void this.processPending(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processPending(): Promise<number> {
    if (!this.mail.isConfigured()) return 0;

    const rows = await this.prisma.partnerNotificationOutbox.findMany({
      where: { sentAt: null, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });

    let sent = 0;
    for (const row of rows) {
      try {
        await this.mail.send({
          to: row.toEmail,
          subject: row.subject,
          body: row.body,
        });
        await this.prisma.partnerNotificationOutbox.update({
          where: { id: row.id },
          data: { sentAt: new Date(), lastError: null },
        });
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'send failed';
        await this.prisma.partnerNotificationOutbox.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 }, lastError: msg.slice(0, 500) },
        });
        this.logger.warn(`Outbox ${row.id} failed: ${msg}`);
      }
    }
    return sent;
  }
}
