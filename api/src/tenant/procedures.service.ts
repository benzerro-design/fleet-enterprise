import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, ProcedureStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import { PrismaService } from '../prisma/prisma.service';

type ProcedureBody = {
  title?: string;
  steps?: unknown;
  screenPath?: string | null;
  status?: string;
};

function parseSteps(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) {
    throw new BadRequestException('steps must be 1–30 text lines');
  }
  const steps = raw.map((step) => (typeof step === 'string' ? step.trim() : ''));
  if (steps.some((step) => !step || step.length > 500)) {
    throw new BadRequestException('Each step must be 1–500 characters');
  }
  return steps;
}

function parseStatus(raw: string | undefined, fallback: ProcedureStatus): ProcedureStatus {
  if (raw === undefined) return fallback;
  if (raw === 'draft' || raw === 'published' || raw === 'withdrawn') return raw;
  throw new BadRequestException('status must be draft, published, or withdrawn');
}

@Injectable()
export class ProceduresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string, access: AccessContext | undefined) {
    const tenant = await this.tenantOrThrow(tenantSlug);
    const admin = this.isTenantAdmin(access);
    const rows = await this.prisma.workProcedure.findMany({
      where: {
        tenantId: tenant.id,
        ...(admin ? {} : { status: ProcedureStatus.published }),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return { items: rows.map((row) => this.toRow(row)) };
  }

  async create(tenantSlug: string, access: AccessContext | undefined, body: ProcedureBody, actorUserId: string) {
    this.assertAdmin(access);
    const tenant = await this.tenantOrThrow(tenantSlug);
    const title = body.title?.trim() ?? '';
    if (!title || title.length > 160) throw new BadRequestException('title is required (max 160)');
    const status = parseStatus(body.status, ProcedureStatus.draft);
    const row = await this.prisma.workProcedure.create({
      data: {
        tenantId: tenant.id,
        title,
        steps: parseSteps(body.steps) as Prisma.InputJsonValue,
        screenPath: this.screenPath(body.screenPath),
        status,
        ownerUserId: actorUserId,
        publishedAt: status === ProcedureStatus.published ? new Date() : null,
      },
    });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_procedure_create',
      entityType: 'work_procedure',
      entityId: row.id,
      meta: { status: row.status, version: row.version },
    });
    return this.toRow(row);
  }

  async update(
    tenantSlug: string,
    access: AccessContext | undefined,
    id: string,
    body: ProcedureBody,
    actorUserId: string,
  ) {
    this.assertAdmin(access);
    const tenant = await this.tenantOrThrow(tenantSlug);
    const existing = await this.prisma.workProcedure.findFirst({ where: { id, tenantId: tenant.id } });
    if (!existing) throw new NotFoundException('Procedure not found');
    const status = parseStatus(body.status, existing.status);
    const publishing = status === ProcedureStatus.published && existing.status !== ProcedureStatus.published;
    const row = await this.prisma.workProcedure.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined
          ? { title: body.title.trim() || existing.title }
          : {}),
        ...(body.steps !== undefined ? { steps: parseSteps(body.steps) as Prisma.InputJsonValue } : {}),
        ...(body.screenPath !== undefined ? { screenPath: this.screenPath(body.screenPath) } : {}),
        status,
        version: existing.version + 1,
        publishedAt: publishing ? new Date() : status === ProcedureStatus.published ? existing.publishedAt : null,
      },
    });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'work_procedure_update',
      entityType: 'work_procedure',
      entityId: row.id,
      meta: { status: row.status, version: row.version },
    });
    return this.toRow(row);
  }

  private toRow(row: {
    id: string;
    title: string;
    status: ProcedureStatus;
    version: number;
    steps: Prisma.JsonValue;
    screenPath: string | null;
    ownerUserId: string | null;
    publishedAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      version: row.version,
      steps: Array.isArray(row.steps) ? row.steps.filter((s): s is string => typeof s === 'string') : [],
      screenPath: row.screenPath,
      ownerUserId: row.ownerUserId,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private screenPath(raw: string | null | undefined): string | null {
    const value = raw?.trim() ?? '';
    if (!value) return null;
    if (!value.startsWith('/fleet/') || value.length > 200) {
      throw new BadRequestException('screenPath must start with /fleet/');
    }
    return value;
  }

  private isTenantAdmin(access: AccessContext | undefined): boolean {
    return access?.membershipRole === MembershipRole.tenant_admin;
  }

  private assertAdmin(access: AccessContext | undefined) {
    if (!this.isTenantAdmin(access)) throw new ForbiddenException('Only tenant admin can edit procedures');
  }

  private async tenantOrThrow(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
