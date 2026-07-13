import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PartnerNotificationKind =
  | 'wo_created'
  | 'quote_submitted'
  | 'quote_approved'
  | 'quote_rejected'
  | 'appointment_confirmed'
  | 'invoice_recorded';

@Injectable()
export class PartnerNotificationService {
  private readonly logger = new Logger(PartnerNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: {
    tenantId: string;
    supplierId?: string | null;
    toEmail: string;
    kind: PartnerNotificationKind;
    subject: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    const email = input.toEmail.trim().toLowerCase();
    if (!email) return;

    await this.prisma.partnerNotificationOutbox.create({
      data: {
        tenantId: input.tenantId,
        supplierId: input.supplierId?.trim() || null,
        toEmail: email,
        kind: input.kind,
        subject: input.subject.trim(),
        body: input.body.trim(),
        payload: input.payload ?? undefined,
      },
    });

    this.logger.log(`[partner-notify] ${input.kind} → ${email}: ${input.subject}`);
  }

  async notifySupplierContact(
    tenantId: string,
    supplierId: string | null | undefined,
    kind: PartnerNotificationKind,
    subject: string,
    body: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<void> {
    if (!supplierId) return;
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
      select: { contactEmail: true },
    });
    if (!supplier?.contactEmail?.trim()) return;
    await this.enqueue({
      tenantId,
      supplierId,
      toEmail: supplier.contactEmail,
      kind,
      subject,
      body,
      payload,
    });
  }
}
