import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientRole, MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { resolveClientInTenant } from '../clients/client-resolve';
import { PrismaService } from '../prisma/prisma.service';

export type CreateClientMembershipInput = {
  email: string;
  displayName?: string | null;
  password?: string | null;
  clientId: string;
  role: ClientRole;
  driverId?: string | null;
};

@Injectable()
export class ClientMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return [];

    const rows = await this.prisma.clientMembership.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ client: { code: 'asc' } }, { user: { email: 'asc' } }],
      include: {
        client: { select: { code: true, legalName: true } },
        user: { select: { email: true, displayName: true } },
        driver: { select: { fullName: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientCode: r.client.code,
      clientLegalName: r.client.legalName,
      userId: r.userId,
      email: r.user.email,
      displayName: r.user.displayName,
      role: r.role,
      driverId: r.driverId,
      driverFullName: r.driver?.fullName ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(
    tenantSlug: string,
    dto: CreateClientMembershipInput,
    actorUserId?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = dto.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('email is required');

    const client = await resolveClientInTenant(this.prisma, tenant.id, dto.clientId);
    const role = parseClientRole(dto.role);

    if (role === ClientRole.driver) {
      const driverId = dto.driverId?.trim();
      if (!driverId) {
        throw new BadRequestException('driverId is required for driver role');
      }
      const driver = await this.prisma.driver.findFirst({
        where: { id: driverId, tenantId: tenant.id, clientId: client.id },
      });
      if (!driver) throw new BadRequestException('Driver not found for client');
    }

    const password = dto.password?.trim();
    if (!password || password.length < 10) {
      throw new BadRequestException('password must be at least 10 characters');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = dto.displayName?.trim() || email;

    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, displayName },
      update: { displayName },
    });

    await this.prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      create: { userId: user.id, tenantId: tenant.id, role: MembershipRole.client_user },
      update: { role: MembershipRole.client_user },
    });

    const row = await this.prisma.clientMembership.upsert({
      where: {
        userId_tenantId_clientId: {
          userId: user.id,
          tenantId: tenant.id,
          clientId: client.id,
        },
      },
      create: {
        tenantId: tenant.id,
        clientId: client.id,
        userId: user.id,
        role,
        driverId: role === ClientRole.driver ? dto.driverId!.trim() : null,
      },
      update: {
        role,
        driverId: role === ClientRole.driver ? dto.driverId!.trim() : null,
      },
      include: {
        client: { select: { code: true, legalName: true } },
        user: { select: { email: true, displayName: true } },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client_membership.create',
      entityType: 'client_membership',
      entityId: row.id,
      meta: { email, clientCode: client.code, role },
    });

    return {
      id: row.id,
      clientId: row.clientId,
      clientCode: row.client.code,
      userId: row.userId,
      email: row.user.email,
      role: row.role,
    };
  }

  async remove(tenantSlug: string, id: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.clientMembership.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Client membership not found');

    await this.prisma.clientMembership.delete({ where: { id } });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client_membership.delete',
      entityType: 'client_membership',
      entityId: id,
      meta: { userId: existing.userId, clientId: existing.clientId },
    });
  }
}

function parseClientRole(raw: string | ClientRole): ClientRole {
  const allowed: ClientRole[] = [
    ClientRole.client_admin,
    ClientRole.client_dispatcher,
    ClientRole.client_viewer,
    ClientRole.driver,
  ];
  if (!allowed.includes(raw as ClientRole)) {
    throw new BadRequestException('Invalid client role');
  }
  return raw as ClientRole;
}
