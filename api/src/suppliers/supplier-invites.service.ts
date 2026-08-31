import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipRole, SupplierRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import { isPartnerUser } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';

export type SupplierInviteRecord = {
  id: string;
  email: string;
  role: SupplierRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  inviteUrl: string;
  createdAt: string;
};

@Injectable()
export class SupplierInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private inviteUrl(token: string): string {
    const base =
      process.env.WEB_ORIGIN?.trim() ||
      process.env.WEB_PUBLIC_URL?.trim() ||
      'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/invite/partner/${token}`;
  }

  async listForSupplier(
    tenantSlug: string,
    supplierId: string,
    access?: AccessContext,
  ): Promise<SupplierInviteRecord[]> {
    this.assertCanManageInvites(access, supplierId);
    const rows = await this.prisma.supplierInvite.findMany({
      where: { supplierId, tenant: { slug: tenantSlug }, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async create(
    tenantSlug: string,
    supplierId: string,
    input: { email: string; role?: SupplierRole },
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<SupplierInviteRecord> {
    this.assertCanManageInvites(access, supplierId);
    const email = input.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant: { slug: tenantSlug } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const role = this.parseInviteRole(input.role, access);

    try {
      const row = await this.prisma.supplierInvite.create({
        data: {
          tenantId: supplier.tenantId,
          supplierId,
          email,
          role,
          token,
          expiresAt,
          createdByUserId: actorUserId ?? null,
        },
      });
      await this.audit.log({
        tenantId: supplier.tenantId,
        actorUserId,
        action: 'supplier.invite_create',
        entityType: 'supplier_invite',
        entityId: row.id,
        meta: { email, supplierId },
      });
      return this.toRecord(row);
    } catch (e) {
      throw new ConflictException('Could not create invite');
    }
  }

  async preview(token: string) {
    const row = await this.findValidInvite(token);
    const [supplier, tenant] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: row.supplierId },
        select: { code: true, legalName: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: row.tenantId },
        select: { slug: true },
      }),
    ]);
    return {
      email: row.email,
      role: row.role,
      tenantSlug: tenant?.slug ?? 'demo',
      supplierCode: supplier?.code ?? '—',
      supplierLegalName: supplier?.legalName ?? 'Furnizor',
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /** Accept when caller is already authenticated (JWT). */
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

  /** Accept fără sesiune — creează cont sau verifică parola pentru emailul din invitație. */
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
      supplierId: string;
      email: string;
      role: SupplierRole;
    },
    userId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: row.tenantId },
      select: { slug: true },
    });

    const existingSupplierMembership = await this.prisma.supplierMembership.findFirst({
      where: { userId, tenantId: row.tenantId, supplierId: row.supplierId },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!existingSupplierMembership) {
        await tx.supplierMembership.create({
          data: {
            tenantId: row.tenantId,
            supplierId: row.supplierId,
            userId,
            role: row.role,
          },
        });
      }

      const tenantMembership = await tx.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId: row.tenantId } },
      });
      if (!tenantMembership) {
        await tx.tenantMembership.create({
          data: { userId, tenantId: row.tenantId, role: MembershipRole.supplier_user },
        });
      } else if (tenantMembership.role !== MembershipRole.supplier_user) {
        throw new BadRequestException(
          'Contul are deja un alt rol pe acest tenant — folosește un email dedicat furnizorului',
        );
      }

      await tx.supplierInvite.update({
        where: { id: row.id },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });
    });

    return {
      ok: true as const,
      supplierId: row.supplierId,
      tenantSlug: tenant?.slug ?? 'demo',
      email: row.email,
    };
  }

  private async findValidInvite(token: string) {
    const row = await this.prisma.supplierInvite.findFirst({ where: { token: token.trim() } });
    if (!row) throw new NotFoundException('Invite not found');
    if (row.acceptedAt) throw new BadRequestException('Invite already accepted');
    if (row.expiresAt.getTime() < Date.now()) throw new BadRequestException('Invite expired');
    return row;
  }

  private assertCanManageInvites(access: AccessContext | undefined, supplierId: string): void {
    if (!access) return;
    if (access.membershipRole === MembershipRole.tenant_admin) return;
    if (isPartnerUser(access)) {
      const ok = access.supplierMemberships.some(
        (m) => m.supplierId === supplierId && m.role === SupplierRole.supplier_manager,
      );
      if (!ok) throw new ForbiddenException('Only supplier manager can invite');
      return;
    }
    throw new ForbiddenException('Not allowed');
  }

  private parseInviteRole(raw: SupplierRole | undefined, access?: AccessContext): SupplierRole {
    const role = raw ?? SupplierRole.supplier_staff;
    const allowed: SupplierRole[] = [
      SupplierRole.supplier_manager,
      SupplierRole.supplier_staff,
      SupplierRole.supplier_accountant,
    ];
    if (!allowed.includes(role)) {
      throw new BadRequestException('Invalid supplier role');
    }
    if (access && isPartnerUser(access) && role === SupplierRole.supplier_manager) {
      throw new ForbiddenException('Partenerul poate invita R1/R0, nu un alt manager');
    }
    return role;
  }

  private toRecord(row: {
    id: string;
    email: string;
    role: SupplierRole;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }): SupplierInviteRecord {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      token: row.token,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      inviteUrl: this.inviteUrl(row.token),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
