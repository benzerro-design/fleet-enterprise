import { Injectable, Logger } from '@nestjs/common';
import { ClientRole, MembershipRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerMailService } from '../partner/partner-mail.service';
import {
  parseClientNotificationSettings,
  shouldEmailNotify,
  type NotificationEvent,
  type NotificationRole,
} from '../tenant/client-notification-settings';
import { parseTenantMailSettings } from '../tenant/mail-settings';

/**
 * SETUP-006 runtime — trimite email pe evenimente CRM conform matricei tenant.
 * Eșecurile SMTP nu blochează fluxul operațional.
 */
@Injectable()
export class ClientNotificationMailService {
  private readonly logger = new Logger(ClientNotificationMailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: PartnerMailService,
  ) {}

  async notify(input: {
    tenantId: string;
    clientId: string;
    event: NotificationEvent;
    subject: string;
    body: string;
    /** Preferă acest șofer pentru rolul L0; altfel toți șoferii cu email pe client. */
    driverId?: string | null;
  }): Promise<void> {
    try {
      if (!this.mail.isConfigured()) return;

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { clientNotificationSettings: true, mailSettings: true },
      });
      if (!tenant) return;

      const settings = parseClientNotificationSettings(tenant.clientNotificationSettings);
      const roles: NotificationRole[] = (['l1', 'l0', 'l_star'] as const).filter((r) =>
        shouldEmailNotify(settings, input.event, r),
      );
      if (roles.length === 0) return;

      const recipients = await this.resolveRecipients({
        tenantId: input.tenantId,
        clientId: input.clientId,
        roles,
        driverId: input.driverId,
      });
      if (recipients.length === 0) return;

      const mailOpts = parseTenantMailSettings(tenant.mailSettings);
      const signature = mailOpts.signature?.trim() || 'Fleet Enterprise';
      const text = `${input.body}\n\n—\n${signature}`;

      for (const to of recipients) {
        try {
          await this.mail.send({
            to,
            subject: input.subject,
            body: text,
            fromName: mailOpts.fromName,
            replyTo: mailOpts.replyTo,
          });
        } catch (err) {
          this.logger.warn(
            `Notify ${input.event} → ${to} failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `notify(${input.event}) failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async resolveRecipients(input: {
    tenantId: string;
    clientId: string;
    roles: NotificationRole[];
    driverId?: string | null;
  }): Promise<string[]> {
    const emails = new Set<string>();

    if (input.roles.includes('l1')) {
      const members = await this.prisma.clientMembership.findMany({
        where: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          role: { in: [ClientRole.client_admin, ClientRole.client_dispatcher] },
        },
        select: { user: { select: { email: true } } },
      });
      for (const m of members) {
        const e = m.user.email?.trim().toLowerCase();
        if (e) emails.add(e);
      }
    }

    if (input.roles.includes('l0')) {
      if (input.driverId) {
        const driver = await this.prisma.driver.findFirst({
          where: {
            id: input.driverId,
            tenantId: input.tenantId,
            clientId: input.clientId,
          },
          select: { email: true },
        });
        const e = driver?.email?.trim().toLowerCase();
        if (e) emails.add(e);
      } else {
        const drivers = await this.prisma.driver.findMany({
          where: {
            tenantId: input.tenantId,
            clientId: input.clientId,
            email: { not: null },
          },
          select: { email: true },
          take: 20,
        });
        for (const d of drivers) {
          const e = d.email?.trim().toLowerCase();
          if (e) emails.add(e);
        }
      }
    }

    if (input.roles.includes('l_star')) {
      const admins = await this.prisma.user.findMany({
        where: {
          memberships: {
            some: {
              tenantId: input.tenantId,
              role: MembershipRole.tenant_admin,
            },
          },
        },
        select: { email: true },
        take: 30,
      });
      for (const u of admins) {
        const e = u.email?.trim().toLowerCase();
        if (e) emails.add(e);
      }
    }

    return [...emails];
  }
}
