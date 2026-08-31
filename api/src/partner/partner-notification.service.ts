import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { isPartnerUser } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';

export type PartnerNotificationKind =
  | 'wo_created'
  | 'quote_submitted'
  | 'quote_approved'
  | 'quote_rejected'
  | 'appointment_confirmed'
  | 'invoice_recorded';

export type PartnerNotificationRecord = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
  sentAt: string | null;
};

function payloadRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function webOrigin(): string {
  return (process.env.WEB_ORIGIN ?? '').replace(/\/$/, '');
}

/** Cale relativă în portalul partener (UAT-022). */
export function partnerNotificationHref(kind: string, payload: unknown): string {
  const p = payloadRecord(payload);
  if (typeof p.href === 'string' && p.href.startsWith('/')) return p.href;
  if (typeof p.workOrderId === 'string' && p.workOrderId.trim()) {
    return `/fleet/partner/work-orders/${p.workOrderId.trim()}`;
  }
  if (typeof p.appointmentId === 'string' && p.appointmentId.trim()) {
    return `/fleet/partner/appointments?select=${encodeURIComponent(p.appointmentId.trim())}`;
  }
  if (kind === 'appointment_confirmed') return '/fleet/partner/appointments';
  return '/fleet/partner/work-orders';
}

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

    const basePayload = payloadRecord(input.payload);
    const href = partnerNotificationHref(input.kind, basePayload);
    const origin = webOrigin();
    const absolute = origin ? `${origin}${href}` : href;
    let body = input.body.trim();
    if (!body.includes(href) && !body.includes(absolute)) {
      body = `${body}\n\nDeschide în portal: ${absolute}`;
    }

    await this.prisma.partnerNotificationOutbox.create({
      data: {
        tenantId: input.tenantId,
        supplierId: input.supplierId?.trim() || null,
        toEmail: email,
        kind: input.kind,
        subject: input.subject.trim(),
        body,
        payload: { ...basePayload, href } as Prisma.InputJsonValue,
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

  async listForAccess(
    tenantSlug: string,
    access: AccessContext,
    opts?: { unreadOnly?: boolean; supplierId?: string; limit?: number },
  ): Promise<{ items: PartnerNotificationRecord[]; unreadCount: number }> {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const supplierIds = this.scopeSupplierIds(access, opts?.supplierId);
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 50);

    const where: Prisma.PartnerNotificationOutboxWhereInput = {
      tenantId: tenant.id,
      ...(supplierIds ? { supplierId: { in: supplierIds } } : {}),
      ...(opts?.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      this.prisma.partnerNotificationOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.partnerNotificationOutbox.count({
        where: {
          tenantId: tenant.id,
          readAt: null,
          ...(supplierIds ? { supplierId: { in: supplierIds } } : {}),
        },
      }),
    ]);

    const caseIds = [
      ...new Set(
        rows
          .map((r) => payloadRecord(r.payload).serviceCaseId)
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
      ),
    ];
    const woByCase = new Map<string, string>();
    if (caseIds.length) {
      const wos = await this.prisma.maintenanceWorkOrder.findMany({
        where: { tenantId: tenant.id, serviceCaseId: { in: caseIds } },
        select: { id: true, serviceCaseId: true },
      });
      for (const wo of wos) woByCase.set(wo.serviceCaseId, wo.id);
    }

    return {
      unreadCount,
      items: rows.map((r) => {
        const p = payloadRecord(r.payload);
        if (typeof p.workOrderId !== 'string' && typeof p.serviceCaseId === 'string') {
          const woId = woByCase.get(p.serviceCaseId);
          if (woId) p.workOrderId = woId;
        }
        return {
          id: r.id,
          kind: r.kind,
          subject: r.subject,
          body: r.body,
          href: partnerNotificationHref(r.kind, p),
          createdAt: r.createdAt.toISOString(),
          readAt: r.readAt?.toISOString() ?? null,
          sentAt: r.sentAt?.toISOString() ?? null,
        };
      }),
    };
  }

  async markRead(tenantSlug: string, id: string, access: AccessContext): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const row = await this.prisma.partnerNotificationOutbox.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!row) throw new NotFoundException('Notification not found');
    this.assertCanAccessRow(access, row.supplierId);
    if (row.readAt) return;
    await this.prisma.partnerNotificationOutbox.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantSlug: string, access: AccessContext, supplierId?: string): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const supplierIds = this.scopeSupplierIds(access, supplierId);
    await this.prisma.partnerNotificationOutbox.updateMany({
      where: {
        tenantId: tenant.id,
        readAt: null,
        ...(supplierIds ? { supplierId: { in: supplierIds } } : {}),
      },
      data: { readAt: new Date() },
    });
  }

  private scopeSupplierIds(access: AccessContext, requested?: string): string[] | undefined {
    if (isPartnerUser(access)) {
      const allowed = access.allowedSupplierIds ?? [];
      if (allowed.length === 0) throw new ForbiddenException('No supplier membership');
      if (requested?.trim()) {
        if (!allowed.includes(requested.trim())) {
          throw new ForbiddenException('Supplier access denied');
        }
        return [requested.trim()];
      }
      return allowed;
    }
    if (!access.isTenantWide) {
      throw new ForbiddenException('Not allowed');
    }
    return requested?.trim() ? [requested.trim()] : undefined;
  }

  private assertCanAccessRow(access: AccessContext, supplierId: string | null): void {
    if (access.isTenantWide) return;
    if (isPartnerUser(access)) {
      if (!supplierId || !access.allowedSupplierIds.includes(supplierId)) {
        throw new ForbiddenException('Supplier access denied');
      }
      return;
    }
    throw new ForbiddenException('Not allowed');
  }
}
