import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
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
      meta: { basis: next.basis, ruleCount: next.rules.length },
    });
    return next;
  }
}
