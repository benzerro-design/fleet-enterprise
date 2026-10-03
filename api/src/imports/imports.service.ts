import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientRole,
  DriverStatus,
  ImportJobStatus,
  MembershipRole,
  Prisma,
  SupplierStatus,
  FuelType,
  VehicleType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import { isTenantWideAccess } from '../iam/client-access';
import { PrismaService } from '../prisma/prisma.service';
import { parseImportSettings } from '../tenant/import-settings';
import { parseCsv, rowToObject } from './csv-parse';

const MAX_ROWS = 2000;

type RowError = { row: number; message: string };

export type ImportRunResult = {
  id: string;
  entity: string;
  templateId: string | null;
  status: ImportJobStatus;
  dryRun: boolean;
  fileName: string | null;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorReport: RowError[];
  summary: Record<string, unknown> | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listJobs(tenantSlug: string, access: AccessContext): Promise<ImportRunResult[]> {
    const tenant = await this.ensureTenant(tenantSlug);
    this.assertCanImport(access, tenant.importSettings);
    const rows = await this.prisma.importJob.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return rows.map((r) => this.toResult(r));
  }

  async run(
    tenantSlug: string,
    body: {
      entity: string;
      templateId?: string | null;
      csvText: string;
      dryRun?: boolean;
      fileName?: string | null;
    },
    actorUserId: string | undefined,
    access: AccessContext,
  ): Promise<ImportRunResult> {
    const tenant = await this.ensureTenant(tenantSlug);
    const settings = parseImportSettings(tenant.importSettings);
    this.assertCanImport(access, tenant.importSettings);

    const entity = (body.entity ?? '').trim();
    if (!entity) throw new BadRequestException('entity is required');
    const ent = settings.entities.find((e) => e.code === entity && e.enabled);
    if (!ent) throw new BadRequestException(`Entity ${entity} is not enabled for import`);

    const dryRun = body.dryRun !== false;

    const csvText = body.csvText ?? '';
    if (!csvText.trim()) throw new BadRequestException('csvText is required');

    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0) throw new BadRequestException('CSV fără antet');
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`Maxim ${MAX_ROWS} rânduri pe import`);
    }

    let templateCols: string[] | null = null;
    const templateId = body.templateId?.trim() || null;
    if (templateId) {
      const tpl = settings.templates.find(
        (t) => t.id === templateId && t.enabled && t.entity === entity,
      );
      if (!tpl) throw new BadRequestException('Template invalid');
      templateCols = tpl.columns;
      for (const col of tpl.columns) {
        if (!headers.includes(col)) {
          throw new BadRequestException(`Coloană lipsă în CSV: ${col}`);
        }
      }
    }

    const job = await this.prisma.importJob.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actorUserId ?? null,
        entity,
        templateId,
        status: ImportJobStatus.dry_run,
        fileName: body.fileName?.trim() || null,
        dryRun,
        totalRows: rows.length,
        startedAt: new Date(),
      },
    });

    const errors: RowError[] = [];
    let success = 0;
    const summary: Record<string, number> = { created: 0, updated: 0, skipped: 0 };

    try {
      for (let i = 0; i < rows.length; i++) {
        const lineNo = i + 2; // 1-based + header
        const obj = rowToObject(headers, rows[i]!);
        if (templateCols) {
          for (const col of templateCols) {
            if (!(col in obj)) obj[col] = '';
          }
        }
        try {
          const outcome = await this.applyRow({
            entity,
            tenantId: tenant.id,
            obj,
            dryRun,
            access,
          });
          success++;
          summary[outcome] = (summary[outcome] ?? 0) + 1;
        } catch (e) {
          errors.push({
            row: lineNo,
            message: e instanceof Error ? e.message : 'Eroare pe rând',
          });
        }
      }

      const status =
        errors.length === rows.length && rows.length > 0
          ? ImportJobStatus.failed
          : dryRun
            ? ImportJobStatus.dry_run
            : ImportJobStatus.completed;

      const updated = await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status,
          successRows: success,
          errorRows: errors.length,
          errorReport: errors as unknown as Prisma.InputJsonValue,
          summary: summary as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });

      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: dryRun ? 'import.dry_run' : 'import.write',
        entityType: 'import_job',
        entityId: job.id,
        meta: { entity, success, errors: errors.length },
      });

      return this.toResult(updated);
    } catch (e) {
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportJobStatus.failed,
          errorRows: rows.length,
          errorReport: [
            { row: 0, message: e instanceof Error ? e.message : 'Import failed' },
          ] as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      throw e;
    }
  }

  private async applyRow(input: {
    entity: string;
    tenantId: string;
    obj: Record<string, string>;
    dryRun: boolean;
    access: AccessContext;
  }): Promise<'created' | 'updated' | 'skipped'> {
    switch (input.entity) {
      case 'vehicles':
        return this.applyVehicle(input);
      case 'drivers':
        return this.applyDriver(input);
      case 'suppliers':
        return this.applySupplier(input);
      default:
        throw new BadRequestException(`Import pentru ${input.entity} nu e implementat încă`);
    }
  }

  private async applyVehicle(input: {
    tenantId: string;
    obj: Record<string, string>;
    dryRun: boolean;
    access: AccessContext;
  }): Promise<'created' | 'updated' | 'skipped'> {
    const reg = (input.obj.registrationNumber ?? '').trim().toUpperCase();
    if (!reg) throw new Error('registrationNumber lipsește');
    const clientCode = (input.obj.clientCode ?? '').trim();
    if (!clientCode) throw new Error('clientCode lipsește');

    const client = await this.prisma.client.findFirst({
      where: { tenantId: input.tenantId, code: clientCode },
      select: { id: true },
    });
    if (!client) throw new Error(`Client necunoscut: ${clientCode}`);
    this.assertClientScope(input.access, client.id);

    const existing = await this.prisma.vehicle.findFirst({
      where: { tenantId: input.tenantId, registrationNumber: reg },
      select: { id: true },
    });

    const brand = input.obj.brand?.trim() || null;
    const model = input.obj.model?.trim() || null;
    const vin = input.obj.vin?.trim() || null;
    // template may include `year` — stored only if present in civProfile later; ignored for now

    if (input.dryRun) return existing ? 'updated' : 'created';

    if (existing) {
      await this.prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          clientId: client.id,
          brand,
          model,
          vin,
        },
      });
      return 'updated';
    }

    await this.prisma.vehicle.create({
      data: {
        tenantId: input.tenantId,
        clientId: client.id,
        registrationNumber: reg,
        type: VehicleType.car,
        fuelType: FuelType.diesel,
        brand,
        model,
        vin,
        status: 'active',
        odometerKm: 0,
      },
    });
    return 'created';
  }

  private async applyDriver(input: {
    tenantId: string;
    obj: Record<string, string>;
    dryRun: boolean;
    access: AccessContext;
  }): Promise<'created' | 'updated' | 'skipped'> {
    const fullName = (input.obj.fullName ?? '').trim();
    if (!fullName) throw new Error('fullName lipsește');
    const clientCode = (input.obj.clientCode ?? '').trim();
    if (!clientCode) throw new Error('clientCode lipsește');

    const client = await this.prisma.client.findFirst({
      where: { tenantId: input.tenantId, code: clientCode },
      select: { id: true },
    });
    if (!client) throw new Error(`Client necunoscut: ${clientCode}`);
    this.assertClientScope(input.access, client.id);

    const email = input.obj.email?.trim() || null;
    const phone = input.obj.phone?.trim() || null;
    const licenseNumber = input.obj.licenseNumber?.trim() || null;

    const existing = email
      ? await this.prisma.driver.findFirst({
          where: { tenantId: input.tenantId, clientId: client.id, email },
          select: { id: true },
        })
      : licenseNumber
        ? await this.prisma.driver.findFirst({
            where: { tenantId: input.tenantId, clientId: client.id, licenseNumber },
            select: { id: true },
          })
        : null;

    if (input.dryRun) return existing ? 'updated' : 'created';

    if (existing) {
      await this.prisma.driver.update({
        where: { id: existing.id },
        data: { fullName, phone, email, licenseNumber },
      });
      return 'updated';
    }

    await this.prisma.driver.create({
      data: {
        tenantId: input.tenantId,
        clientId: client.id,
        fullName,
        phone,
        email,
        licenseNumber,
        status: DriverStatus.active,
      },
    });
    return 'created';
  }

  private async applySupplier(input: {
    tenantId: string;
    obj: Record<string, string>;
    dryRun: boolean;
    access: AccessContext;
  }): Promise<'created' | 'updated' | 'skipped'> {
    if (!isTenantWideAccess(input.access) || input.access.membershipRole !== MembershipRole.tenant_admin) {
      throw new Error('Doar L* poate importa furnizori');
    }
    const code = (input.obj.code ?? '').trim().toLowerCase();
    const legalName = (input.obj.legalName ?? '').trim();
    if (!code) throw new Error('code lipsește');
    if (!legalName) throw new Error('legalName lipsește');

    const existing = await this.prisma.supplier.findFirst({
      where: { tenantId: input.tenantId, code },
      select: { id: true },
    });

    const taxId = input.obj.taxId?.trim() || null;
    const category = input.obj.category?.trim() || 'other';
    const contactEmail = input.obj.contactEmail?.trim() || null;
    const contactPhone = input.obj.contactPhone?.trim() || null;

    if (input.dryRun) return existing ? 'updated' : 'created';

    if (existing) {
      await this.prisma.supplier.update({
        where: { id: existing.id },
        data: { legalName, taxId, category, contactEmail, contactPhone },
      });
      return 'updated';
    }

    await this.prisma.supplier.create({
      data: {
        tenantId: input.tenantId,
        code,
        legalName,
        taxId,
        category,
        contactEmail,
        contactPhone,
        status: SupplierStatus.active,
        slotCapacity: 4,
        partsDiscountPercent: 0,
        laborDiscountPercent: 0,
      },
    });
    return 'created';
  }

  private assertCanImport(access: AccessContext, importSettingsRaw: unknown): void {
    const settings = parseImportSettings(importSettingsRaw);
    const isTenantAdmin =
      isTenantWideAccess(access) && access.membershipRole === MembershipRole.tenant_admin;
    const isClientAdmin =
      access.membershipRole === MembershipRole.client_user &&
      access.clientMemberships.some((m) => m.role === ClientRole.client_admin);

    if (isTenantAdmin && settings.allowTenantAdminImport) return;
    if (isClientAdmin && settings.allowClientAdminImport) return;
    throw new ForbiddenException('Nu ai dreptul să imporți în masă');
  }

  private assertClientScope(access: AccessContext, clientId: string): void {
    if (isTenantWideAccess(access)) return;
    if (!access.allowedClientIds.includes(clientId)) {
      throw new Error('Client în afara scope-ului tău');
    }
  }

  private async ensureTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, importSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private toResult(row: {
    id: string;
    entity: string;
    templateId: string | null;
    status: ImportJobStatus;
    dryRun: boolean;
    fileName: string | null;
    totalRows: number;
    successRows: number;
    errorRows: number;
    errorReport: unknown;
    summary: unknown;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
  }): ImportRunResult {
    return {
      id: row.id,
      entity: row.entity,
      templateId: row.templateId,
      status: row.status,
      dryRun: row.dryRun,
      fileName: row.fileName,
      totalRows: row.totalRows,
      successRows: row.successRows,
      errorRows: row.errorRows,
      errorReport: Array.isArray(row.errorReport)
        ? (row.errorReport as RowError[])
        : [],
      summary:
        row.summary && typeof row.summary === 'object'
          ? (row.summary as Record<string, unknown>)
          : null,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
