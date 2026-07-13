import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupplierRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
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
    const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/invite/partner/${token}`;
  }

  async listForSupplier(tenantSlug: string, supplierId: string): Promise<SupplierInviteRecord[]> {
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
  ): Promise<SupplierInviteRecord> {
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
    const role = input.role ?? SupplierRole.supplier_staff;

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
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: row.supplierId },
      select: { code: true, legalName: true },
    });
    return {
      email: row.email,
      role: row.role,
      supplierCode: supplier?.code ?? '—',
      supplierLegalName: supplier?.legalName ?? 'Furnizor',
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async accept(token: string, userId: string, userEmail: string) {
    const row = await this.findValidInvite(token);
    if (userEmail.trim().toLowerCase() !== row.email.trim().toLowerCase()) {
      throw new BadRequestException('Invite email does not match logged-in user');
    }

    const existing = await this.prisma.supplierMembership.findFirst({
      where: { userId, tenantId: row.tenantId, supplierId: row.supplierId },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        await tx.supplierMembership.create({
          data: {
            tenantId: row.tenantId,
            supplierId: row.supplierId,
            userId,
            role: row.role,
          },
        });
      }
      await tx.supplierInvite.update({
        where: { id: row.id },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });
      await tx.tenantMembership.upsert({
        where: { userId_tenantId: { userId, tenantId: row.tenantId } },
        create: { userId, tenantId: row.tenantId, role: 'supplier_user' },
        update: { role: 'supplier_user' },
      });
    });

    return { ok: true as const, supplierId: row.supplierId };
  }

  private async findValidInvite(token: string) {
    const row = await this.prisma.supplierInvite.findFirst({ where: { token: token.trim() } });
    if (!row) throw new NotFoundException('Invite not found');
    if (row.acceptedAt) throw new BadRequestException('Invite already accepted');
    if (row.expiresAt.getTime() < Date.now()) throw new BadRequestException('Invite expired');
    return row;
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
