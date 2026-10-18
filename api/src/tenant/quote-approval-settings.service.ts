import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mergeClientRules,
  parseQuoteApprovalSettings,
  parseQuoteApprovalSettingsBody,
  type QuoteApprovalSettings,
} from './quote-approval-settings';

@Injectable()
export class QuoteApprovalSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantSlug: string): Promise<QuoteApprovalSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { quoteApprovalSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return parseQuoteApprovalSettings(tenant.quoteApprovalSettings);
  }

  async set(tenantSlug: string, body: unknown, actorUserId: string): Promise<QuoteApprovalSettings> {
    let next: QuoteApprovalSettings;
    try {
      next = parseQuoteApprovalSettingsBody(body);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid settings');
    }
    return this.persist(tenantSlug, next, actorUserId);
  }

  /**
   * Salvare pe un client: body = { clientId, basis?, rules: [{ userId, maxAmountCents }] }.
   * basis opțional — dacă lipsește, rămâne cel curent.
   */
  async setForClient(
    tenantSlug: string,
    body: unknown,
    actorUserId: string,
  ): Promise<QuoteApprovalSettings> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid settings');
    }
    const o = body as Record<string, unknown>;
    const clientId = typeof o.clientId === 'string' ? o.clientId.trim() : '';
    if (!clientId) throw new BadRequestException('clientId is required');

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, quoteApprovalSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!client) throw new BadRequestException('Client not found in this tenant');

    const current = parseQuoteApprovalSettings(tenant.quoteApprovalSettings);
    if (o.basis === 'net' || o.basis === 'gross') {
      current.basis = o.basis;
    }

    if (!Array.isArray(o.rules)) {
      throw new BadRequestException('rules must be an array');
    }

    let next: QuoteApprovalSettings;
    try {
      next = mergeClientRules(
        current,
        clientId,
        o.rules.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            userId: typeof r.userId === 'string' ? r.userId : '',
            maxAmountCents:
              typeof r.maxAmountCents === 'number' ? r.maxAmountCents : Number(r.maxAmountCents),
          };
        }),
      );
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid client rules');
    }

    return this.persist(tenantSlug, next, actorUserId, { clientId });
  }

  private async persist(
    tenantSlug: string,
    next: QuoteApprovalSettings,
    actorUserId: string,
    metaExtra?: { clientId?: string },
  ): Promise<QuoteApprovalSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { quoteApprovalSettings: next as unknown as Prisma.InputJsonValue },
    });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'quote_approval_settings_update',
      entityType: 'tenant',
      entityId: tenant.id,
      meta: {
        basis: next.basis,
        ruleCount: next.rules.length,
        ...(metaExtra?.clientId ? { clientId: metaExtra.clientId } : {}),
      },
    });
    return next;
  }
}
