import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientRole, MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { resolveClientInTenant } from '../clients/client-resolve';
import type { AccessContext } from './access-context.types';
import { PrismaService } from '../prisma/prisma.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type UserInviteRecord = {
  id: string;
  email: string;
  targetRole: MembershipRole;
  clientId: string | null;
  clientRole: ClientRole | null;
  expiresAt: string;
  acceptedAt: string | null;
  inviteUrl: string;
  createdAt: string;
};

@Injectable()
export class UserInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private inviteUrl(token: string): string {
    const base =
      process.env.WEB_ORIGIN?.trim() ||
      process.env.WEB_PUBLIC_URL?.trim() ||
      'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/invite/${token}`;
  }

  async listTenantInvites(tenantSlug: string): Promise<UserInviteRecord[]> {
    const tenant = await this.requireTenant(tenantSlug);
    const rows = await this.prisma.userInvite.findMany({
      where: {
        tenantId: tenant.id,
        acceptedAt: null,
        targetRole: { in: [MembershipRole.tenant_admin, MembershipRole.tenant_viewer] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async createTenantInvite(
    tenantSlug: string,
    input: { email: string; targetRole?: string },
    actorUserId?: string,
  ): Promise<UserInviteRecord> {
    const tenant = await this.requireTenant(tenantSlug);
    const email = this.requireEmail(input.email);
    const targetRole = parseTenantTargetRole(input.targetRole);
    return this.insertInvite({
      tenantId: tenant.id,
      email,
      targetRole,
      actorUserId,
      meta: { targetRole },
    });
  }

  async listClientInvites(
    tenantSlug: string,
    clientId: string,
    access: AccessContext,
  ): Promise<UserInviteRecord[]> {
    const tenant = await this.requireTenant(tenantSlug);
    const client = await resolveClientInTenant(this.prisma, tenant.id, clientId);
    this.assertCanInviteClient(access, client.id);
    const rows = await this.prisma.userInvite.findMany({
      where: {
        tenantId: tenant.id,
        clientId: client.id,
        acceptedAt: null,
        targetRole: MembershipRole.client_user,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async createClientInvite(
    tenantSlug: string,
    clientId: string,
    input: { email: string; role?: string; driverId?: string | null },
    access: AccessContext,
    actorUserId?: string,
  ): Promise<UserInviteRecord> {
    const tenant = await this.requireTenant(tenantSlug);
    const client = await resolveClientInTenant(this.prisma, tenant.id, clientId);
    this.assertCanInviteClient(access, client.id);
    const email = this.requireEmail(input.email);
    const clientRole = parseClientRole(input.role);
    let driverId: string | null = null;
    if (clientRole === ClientRole.driver) {
      const did = input.driverId?.trim();
      if (!did) throw new BadRequestException('driverId is required for driver role');
      const driver = await this.prisma.driver.findFirst({
        where: { id: did, tenantId: tenant.id, clientId: client.id },
      });
      if (!driver) throw new BadRequestException('Driver not found for client');
      driverId = did;
    }
    return this.insertInvite({
      tenantId: tenant.id,
      email,
      targetRole: MembershipRole.client_user,
      clientId: client.id,
      clientRole,
      driverId,
      actorUserId,
      meta: { clientCode: client.code, clientRole },
    });
  }

  async preview(token: string) {
    const row = await this.findValidInvite(token);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: row.tenantId },
      select: { slug: true, name: true },
    });
    let clientLegalName: string | null = null;
    if (row.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: row.clientId },
        select: { legalName: true, code: true },
      });
      clientLegalName = client ? `${client.code} — ${client.legalName}` : null;
    }
    return {
      email: row.email,
      targetRole: row.targetRole,
      clientRole: row.clientRole,
      clientLegalName,
      tenantSlug: tenant?.slug ?? 'demo',
      tenantName: tenant?.name ?? 'Flotă',
      expiresAt: row.expiresAt.toISOString(),
      redirectPath: this.redirectPath(row.targetRole, row.clientRole),
    };
  }

  async acceptWithAuth(token: string, userId: string) {
    const row = await this.findValidInvite(token);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.email.trim().toLowerCase() !== row.email.trim().toLowerCase()) {
      throw new BadRequestException(
        `Invitația este pentru ${row.email}. Ești autentificat ca ${user.email}.`,
      );
    }
    return this.finalizeAccept(row, userId);
  }

  async acceptWithPassword(token: string, password: string, displayName?: string | null) {
    const row = await this.findValidInvite(token);
    const email = row.email.trim().toLowerCase();
    if (!password || password.length < 10) {
      throw new BadRequestException('Parola trebuie să aibă cel puțin 10 caractere');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    let userId: string;
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: displayName?.trim() || email.split('@')[0],
        },
      });
      userId = user.id;
    } else {
      const ok = await bcrypt.compare(password, existing.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Parolă incorectă pentru acest email');
      }
      userId = existing.id;
    }

    return this.finalizeAccept(row, userId);
  }

  private async finalizeAccept(
    row: {
      id: string;
      tenantId: string;
      email: string;
      targetRole: MembershipRole;
      clientId: string | null;
      clientRole: ClientRole | null;
      driverId: string | null;
    },
    userId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: row.tenantId },
      select: { slug: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId: row.tenantId } },
      });
      if (!existing) {
        await tx.tenantMembership.create({
          data: { userId, tenantId: row.tenantId, role: row.targetRole },
        });
      } else if (existing.role !== row.targetRole) {
        throw new BadRequestException(
          'Contul are deja un alt rol pe acest abonat — folosește un email dedicat',
        );
      }

      if (row.targetRole === MembershipRole.client_user) {
        if (!row.clientId || !row.clientRole) {
          throw new BadRequestException('Invitație client incompletă');
        }
        await tx.clientMembership.upsert({
          where: {
            userId_tenantId_clientId: {
              userId,
              tenantId: row.tenantId,
              clientId: row.clientId,
            },
          },
          create: {
            tenantId: row.tenantId,
            clientId: row.clientId,
            userId,
            role: row.clientRole,
            driverId: row.clientRole === ClientRole.driver ? row.driverId : null,
          },
          update: {
            role: row.clientRole,
            driverId: row.clientRole === ClientRole.driver ? row.driverId : null,
          },
        });
      }

      await tx.userInvite.update({
        where: { id: row.id },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });
    });

    return {
      ok: true as const,
      tenantSlug: tenant?.slug ?? 'demo',
      email: row.email,
      redirectPath: this.redirectPath(row.targetRole, row.clientRole),
    };
  }

  private async insertInvite(input: {
    tenantId: string;
    email: string;
    targetRole: MembershipRole;
    clientId?: string | null;
    clientRole?: ClientRole | null;
    driverId?: string | null;
    actorUserId?: string;
    meta: Record<string, unknown>;
  }): Promise<UserInviteRecord> {
    await this.prisma.userInvite.updateMany({
      where: {
        tenantId: input.tenantId,
        email: input.email,
        acceptedAt: null,
        targetRole: input.targetRole,
        clientId: input.clientId ?? null,
      },
      data: { expiresAt: new Date() },
    });

    const token = randomBytes(24).toString('hex');
    const row = await this.prisma.userInvite.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        targetRole: input.targetRole,
        clientId: input.clientId ?? null,
        clientRole: input.clientRole ?? null,
        driverId: input.driverId ?? null,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdByUserId: input.actorUserId ?? null,
      },
    });
    await this.audit.log({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'user.invite_create',
      entityType: 'user_invite',
      entityId: row.id,
      meta: { email: input.email, ...input.meta },
    });
    return this.toRecord(row);
  }

  private async findValidInvite(token: string) {
    const row = await this.prisma.userInvite.findFirst({ where: { token: token.trim() } });
    if (!row) throw new NotFoundException('Invite not found');
    if (row.acceptedAt) throw new BadRequestException('Invite already accepted');
    if (row.expiresAt.getTime() < Date.now()) throw new BadRequestException('Invite expired');
    return row;
  }

  private async requireTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private requireEmail(raw?: string): string {
    const email = raw?.trim().toLowerCase() ?? '';
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    return email;
  }

  private assertCanInviteClient(access: AccessContext, clientId: string): void {
    if (access.isTenantWide) {
      if (access.membershipRole !== MembershipRole.tenant_admin) {
        throw new ForbiddenException('Only tenant admin can invite for a client');
      }
      return;
    }
    if (access.membershipRole !== MembershipRole.client_user) {
      throw new ForbiddenException('Not allowed');
    }
    if (!access.allowedClientIds.includes(clientId)) {
      throw new ForbiddenException('Client access denied');
    }
    const ok = access.clientMemberships.some(
      (m) =>
        m.clientId === clientId &&
        (m.role === ClientRole.client_admin || m.role === ClientRole.client_dispatcher),
    );
    if (!ok) throw new ForbiddenException('Only client admin or dispatcher can invite');
  }

  private redirectPath(role: MembershipRole, clientRole: ClientRole | null): string {
    if (role === MembershipRole.client_user && clientRole === ClientRole.driver) {
      return '/fleet/vehicles';
    }
    if (role === MembershipRole.client_user) return '/fleet/dashboard';
    return '/fleet/dashboard';
  }

  private toRecord(row: {
    id: string;
    email: string;
    targetRole: MembershipRole;
    clientId: string | null;
    clientRole: ClientRole | null;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }): UserInviteRecord {
    return {
      id: row.id,
      email: row.email,
      targetRole: row.targetRole,
      clientId: row.clientId,
      clientRole: row.clientRole,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      inviteUrl: this.inviteUrl(row.token),
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function parseTenantTargetRole(raw?: string): MembershipRole {
  if (raw === MembershipRole.tenant_viewer) return MembershipRole.tenant_viewer;
  if (!raw || raw === MembershipRole.tenant_admin) return MembershipRole.tenant_admin;
  throw new BadRequestException('targetRole must be tenant_admin or tenant_viewer');
}

function parseClientRole(raw?: string): ClientRole {
  const allowed: ClientRole[] = [
    ClientRole.client_admin,
    ClientRole.client_dispatcher,
    ClientRole.client_viewer,
    ClientRole.driver,
  ];
  const v = (raw ?? ClientRole.client_admin) as ClientRole;
  if (!allowed.includes(v)) throw new BadRequestException('Invalid client role');
  return v;
}
