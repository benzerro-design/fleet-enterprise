import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MaintenancePlanItem } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { normalizeReminderOffsets } from '../ops/document-reminders';
import {
  computeReminderActionSummary,
  normalizeReminderOffsetsKm,
} from '../ops/reminder-status';
import { RemindersService } from '../ops/reminders.service';
import type { AccessContext } from '../iam/access-context.types';
import { assertVehicleOpsRead } from '../ops/ops-write-access';
import {
  reminderMenuSyncEnabledForCreate,
  reminderMenuSyncEnabledPatchValue,
  shouldRunReminderMenuSync,
} from '../ops/reminder-sync';
import type {
  CreateMaintenancePlanItemDto,
  MarkMaintenancePlanPerformedDto,
  PatchMaintenancePlanItemDto,
} from './dto/maintenance-plan.dto';
import {
  computeMaintenancePlanNextDue,
  formatIntervalLabel,
} from './maintenance-plan-compute';
import type {
  MaintenancePlanItemRecord,
  MaintenancePlanPayload,
} from './maintenance-plan.types';
import { PrismaService } from '../prisma/prisma.service';

type PlanRow = MaintenancePlanItem & { vehicle: { odometerKm: number } };

function parseIsoDate(raw: string | null | undefined): Date | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function assertPositiveIntOrNull(v: number | null | undefined, field: string): number | null {
  if (v === undefined || v === null) return null;
  if (!Number.isInteger(v) || v <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return v;
}

function assertNonNegativeIntOrNull(v: number | null | undefined, field: string): number | null {
  if (v === undefined || v === null) return null;
  if (!Number.isInteger(v) || v < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }
  return v;
}

function hasInterval(intervalDays: number | null, intervalKm: number | null): boolean {
  return (intervalDays != null && intervalDays > 0) || (intervalKm != null && intervalKm > 0);
}

function toRecord(row: PlanRow): MaintenancePlanItemRecord {
  const reminderOffsetsDays = normalizeReminderOffsets(row.reminderOffsetsDays);
  const reminderOffsetsKm = normalizeReminderOffsetsKm(row.reminderOffsetsKm);
  const summary = computeReminderActionSummary(
    {
      isActive: row.isActive,
      dueOn: row.nextDueOn,
      reminderOffsetsDays,
      dueOdometerKm: row.dueOdometerKm,
      reminderOffsetsKm,
    },
    row.vehicle.odometerKm,
  );

  return {
    id: row.id,
    vehicleId: row.vehicleId,
    title: row.title,
    category: row.category,
    notes: row.notes,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    intervalDays: row.intervalDays,
    intervalKm: row.intervalKm,
    triggerMode: row.triggerMode,
    lastServiceOn: row.lastServiceOn?.toISOString() ?? null,
    lastServiceKm: row.lastServiceKm,
    nextDueOn: row.nextDueOn?.toISOString() ?? null,
    dueOdometerKm: row.dueOdometerKm,
    dueManualOverride: row.dueManualOverride,
    reminderOffsetsDays,
    reminderOffsetsKm,
    reminderMenuSyncEnabled: row.reminderMenuSyncEnabled,
    preferredProvider: row.preferredProvider,
    estimatedCostCents: row.estimatedCostCents,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    summary,
    intervalLabel: formatIntervalLabel(row.intervalDays, row.intervalKm, row.triggerMode),
  };
}

function computeStats(items: MaintenancePlanItemRecord[]): MaintenancePlanPayload['stats'] {
  const active = items.filter((i) => i.isActive);
  const dueSoon = active.filter(
    (i) => i.summary.status === 'due_soon' || i.summary.status === 'km_due_soon',
  ).length;
  const overdue = active.filter(
    (i) => i.summary.status === 'expired' || i.summary.status === 'km_overdue',
  ).length;
  const syncedReminders = active.filter((i) => i.reminderMenuSyncEnabled).length;
  return {
    total: items.length,
    active: active.length,
    dueSoon,
    overdue,
    syncedReminders,
  };
}

@Injectable()
export class MaintenancePlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
  ) {}

  /** @param tenantSlug — slug din JWT (@TenantId), nu UUID-ul din DB. */
  private async ensureTenant(tenantSlug: string) {
    return this.prisma.tenant.upsert({
      where: { slug: tenantSlug },
      create: { slug: tenantSlug, name: tenantSlug },
      update: { name: tenantSlug },
    });
  }

  private async assertVehicle(tenantSlug: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, registrationNumber: true, odometerKm: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  private resolveNextDue(
    row: Pick<
      MaintenancePlanItem,
      | 'intervalDays'
      | 'intervalKm'
      | 'triggerMode'
      | 'lastServiceOn'
      | 'lastServiceKm'
      | 'dueManualOverride'
      | 'nextDueOn'
      | 'dueOdometerKm'
      | 'createdAt'
    >,
    vehicleOdometerKm: number,
  ) {
    return computeMaintenancePlanNextDue({
      intervalDays: row.intervalDays,
      intervalKm: row.intervalKm,
      triggerMode: row.triggerMode,
      lastServiceOn: row.lastServiceOn,
      lastServiceKm: row.lastServiceKm,
      baselineDate: row.createdAt,
      baselineKm: vehicleOdometerKm,
      dueManualOverride: row.dueManualOverride,
      manualNextDueOn: row.dueManualOverride ? row.nextDueOn : null,
      manualDueOdometerKm: row.dueManualOverride ? row.dueOdometerKm : null,
    });
  }

  private async applyReminderSync(
    tenantUuid: string,
    row: MaintenancePlanItem,
    syncReminderAction?: boolean,
  ): Promise<boolean> {
    try {
      if (shouldRunReminderMenuSync(row.reminderMenuSyncEnabled, syncReminderAction)) {
        await this.reminders.syncFromMaintenancePlan(tenantUuid, {
          id: row.id,
          vehicleId: row.vehicleId,
          title: row.title,
          notes: row.notes,
          nextDueOn: row.nextDueOn,
          reminderOffsetsDays: row.reminderOffsetsDays,
          dueOdometerKm: row.dueOdometerKm,
          reminderOffsetsKm: row.reminderOffsetsKm,
          intervalDays: row.intervalDays,
          intervalKm: row.intervalKm,
          lastServiceOn: row.lastServiceOn,
          lastServiceKm: row.lastServiceKm,
        });
        return false;
      }
      await this.prisma.reminderAction.deleteMany({ where: { maintenancePlanItemId: row.id } });
      return false;
    } catch {
      return true;
    }
  }

  async list(tenantSlug: string, vehicleId: string, access?: AccessContext): Promise<MaintenancePlanPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const tenant = await this.ensureTenant(tenantSlug);
    const vehicle = await this.assertVehicle(tenantSlug, vehicleId);
    const rows = await this.prisma.maintenancePlanItem.findMany({
      where: { tenantId: tenant.id, vehicleId },
      include: { vehicle: { select: { odometerKm: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const items = rows.map(toRecord);
    return { items, vehicleOdometerKm: vehicle.odometerKm, stats: computeStats(items) };
  }

  async create(
    tenantSlug: string,
    vehicleId: string,
    dto: CreateMaintenancePlanItemDto,
    actorUserId?: string,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const vehicle = await this.assertVehicle(tenantSlug, vehicleId);
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('title is required');

    const intervalDays = assertPositiveIntOrNull(dto.intervalDays, 'intervalDays');
    const intervalKm = assertPositiveIntOrNull(dto.intervalKm, 'intervalKm');
    if (!hasInterval(intervalDays, intervalKm)) {
      throw new BadRequestException('At least one interval (intervalDays or intervalKm) is required');
    }

    const lastServiceOn = parseIsoDate(dto.lastServiceOn);
    const lastServiceKm = assertNonNegativeIntOrNull(dto.lastServiceKm, 'lastServiceKm');
    const dueManualOverride = dto.dueManualOverride === true;
    const manualNextDueOn = dueManualOverride ? parseIsoDate(dto.nextDueOn) : null;
    const manualDueOdometerKm = dueManualOverride
      ? assertNonNegativeIntOrNull(dto.dueOdometerKm, 'dueOdometerKm')
      : null;

    const next = computeMaintenancePlanNextDue({
      intervalDays,
      intervalKm,
      triggerMode: dto.triggerMode ?? 'whichever_first',
      lastServiceOn,
      lastServiceKm,
      baselineDate: new Date(),
      baselineKm: vehicle.odometerKm,
      dueManualOverride,
      manualNextDueOn,
      manualDueOdometerKm,
    });

    const dayOffsets =
      dto.reminderOffsetsDays !== undefined
        ? normalizeReminderOffsets(dto.reminderOffsetsDays)
        : [30, 14, 7, 0];
    const kmOffsets =
      dto.reminderOffsetsKm !== undefined
        ? normalizeReminderOffsetsKm(dto.reminderOffsetsKm)
        : [3000, 1000, 500];

    const row = await this.prisma.maintenancePlanItem.create({
      data: {
        tenantId: tenant.id,
        vehicleId,
        title,
        category: dto.category?.trim() || null,
        notes: dto.notes?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive !== false,
        intervalDays,
        intervalKm,
        triggerMode: dto.triggerMode ?? 'whichever_first',
        lastServiceOn,
        lastServiceKm,
        nextDueOn: next.nextDueOn,
        dueOdometerKm: next.dueOdometerKm,
        dueManualOverride,
        reminderOffsetsDays: dayOffsets ?? Prisma.DbNull,
        reminderOffsetsKm: kmOffsets ?? Prisma.DbNull,
        reminderMenuSyncEnabled: reminderMenuSyncEnabledForCreate(dto.syncReminderAction),
        preferredProvider: dto.preferredProvider?.trim() || null,
        estimatedCostCents: dto.estimatedCostCents ?? null,
      },
      include: { vehicle: { select: { odometerKm: true } } },
    });

    const reminderSyncFailed = await this.applyReminderSync(tenant.id, row, dto.syncReminderAction);

    await this.audit.logVehicle({
      tenantUuid: tenant.id,
      actorUserId,
      action: 'maintenance_plan_create',
      vehicleId,
      meta: { itemId: row.id, title: row.title },
    });

    return { ...toRecord(row), reminderSyncFailed };
  }

  async patch(
    tenantSlug: string,
    vehicleId: string,
    itemId: string,
    dto: PatchMaintenancePlanItemDto,
    actorUserId?: string,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const vehicle = await this.assertVehicle(tenantSlug, vehicleId);
    const before = await this.prisma.maintenancePlanItem.findFirst({
      where: { id: itemId, tenantId: tenant.id, vehicleId },
    });
    if (!before) throw new NotFoundException('Maintenance plan item not found');

    const intervalDays =
      dto.intervalDays !== undefined
        ? assertPositiveIntOrNull(dto.intervalDays, 'intervalDays')
        : before.intervalDays;
    const intervalKm =
      dto.intervalKm !== undefined
        ? assertPositiveIntOrNull(dto.intervalKm, 'intervalKm')
        : before.intervalKm;
    if (!hasInterval(intervalDays, intervalKm)) {
      throw new BadRequestException('At least one interval (intervalDays or intervalKm) is required');
    }

    const dueManualOverride =
      dto.dueManualOverride !== undefined ? dto.dueManualOverride : before.dueManualOverride;
    const lastServiceOn =
      dto.lastServiceOn !== undefined ? parseIsoDate(dto.lastServiceOn) : before.lastServiceOn;
    const lastServiceKm =
      dto.lastServiceKm !== undefined
        ? assertNonNegativeIntOrNull(dto.lastServiceKm, 'lastServiceKm')
        : before.lastServiceKm;

    const merged: MaintenancePlanItem = {
      ...before,
      intervalDays,
      intervalKm,
      triggerMode: dto.triggerMode ?? before.triggerMode,
      lastServiceOn,
      lastServiceKm,
      dueManualOverride,
      nextDueOn:
        dto.nextDueOn !== undefined ? parseIsoDate(dto.nextDueOn) : before.nextDueOn,
      dueOdometerKm:
        dto.dueOdometerKm !== undefined
          ? assertNonNegativeIntOrNull(dto.dueOdometerKm, 'dueOdometerKm')
          : before.dueOdometerKm,
    };

    const next = this.resolveNextDue(merged, vehicle.odometerKm);

    const row = await this.prisma.maintenancePlanItem.update({
      where: { id: itemId },
      data: {
        title: dto.title !== undefined ? dto.title.trim() || before.title : undefined,
        category: dto.category !== undefined ? dto.category?.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        intervalDays,
        intervalKm,
        triggerMode: dto.triggerMode,
        lastServiceOn,
        lastServiceKm,
        nextDueOn: next.nextDueOn,
        dueOdometerKm: next.dueOdometerKm,
        dueManualOverride,
        reminderOffsetsDays:
          dto.reminderOffsetsDays !== undefined
            ? normalizeReminderOffsets(dto.reminderOffsetsDays) ?? Prisma.DbNull
            : undefined,
        reminderOffsetsKm:
          dto.reminderOffsetsKm !== undefined
            ? normalizeReminderOffsetsKm(dto.reminderOffsetsKm) ?? Prisma.DbNull
            : undefined,
        reminderMenuSyncEnabled:
          dto.syncReminderAction !== undefined
            ? reminderMenuSyncEnabledPatchValue(dto.syncReminderAction)
            : undefined,
        preferredProvider:
          dto.preferredProvider !== undefined ? dto.preferredProvider?.trim() || null : undefined,
        estimatedCostCents: dto.estimatedCostCents,
      },
      include: { vehicle: { select: { odometerKm: true } } },
    });

    const reminderSyncFailed = await this.applyReminderSync(tenant.id, row, dto.syncReminderAction);

    await this.audit.logVehicle({
      tenantUuid: tenant.id,
      actorUserId,
      action: 'maintenance_plan_update',
      vehicleId,
      meta: { itemId: row.id, title: row.title },
    });

    return { ...toRecord(row), reminderSyncFailed };
  }

  async markPerformed(
    tenantSlug: string,
    vehicleId: string,
    itemId: string,
    dto: MarkMaintenancePlanPerformedDto,
    actorUserId?: string,
  ) {
    const tenant = await this.ensureTenant(tenantSlug);
    const vehicle = await this.assertVehicle(tenantSlug, vehicleId);
    const before = await this.prisma.maintenancePlanItem.findFirst({
      where: { id: itemId, tenantId: tenant.id, vehicleId },
    });
    if (!before) throw new NotFoundException('Maintenance plan item not found');

    const performedOn = parseIsoDate(dto.performedOn) ?? new Date();
    const performedKm =
      dto.performedKm !== undefined && dto.performedKm !== null
        ? assertNonNegativeIntOrNull(dto.performedKm, 'performedKm')!
        : vehicle.odometerKm;

    const notesAppend = dto.notes?.trim();
    const notes =
      notesAppend && before.notes
        ? `${before.notes}\n\n[${performedOn.toISOString().slice(0, 10)}] ${notesAppend}`
        : notesAppend || before.notes;

    const merged: MaintenancePlanItem = {
      ...before,
      lastServiceOn: performedOn,
      lastServiceKm: performedKm,
      dueManualOverride: false,
    };
    const next = this.resolveNextDue(merged, vehicle.odometerKm);

    const row = await this.prisma.maintenancePlanItem.update({
      where: { id: itemId },
      data: {
        lastServiceOn: performedOn,
        lastServiceKm: performedKm,
        nextDueOn: next.nextDueOn,
        dueOdometerKm: next.dueOdometerKm,
        dueManualOverride: false,
        notes,
      },
      include: { vehicle: { select: { odometerKm: true } } },
    });

    const reminderSyncFailed = await this.applyReminderSync(tenant.id, row);

    await this.audit.logVehicle({
      tenantUuid: tenant.id,
      actorUserId,
      action: 'maintenance_plan_performed',
      vehicleId,
      meta: { itemId: row.id, title: row.title, performedKm },
    });

    return { ...toRecord(row), reminderSyncFailed };
  }

  async delete(tenantSlug: string, vehicleId: string, itemId: string, actorUserId?: string) {
    const tenant = await this.ensureTenant(tenantSlug);
    await this.assertVehicle(tenantSlug, vehicleId);
    const row = await this.prisma.maintenancePlanItem.findFirst({
      where: { id: itemId, tenantId: tenant.id, vehicleId },
    });
    if (!row) throw new NotFoundException('Maintenance plan item not found');

    await this.prisma.maintenancePlanItem.delete({ where: { id: itemId } });

    await this.audit.logVehicle({
      tenantUuid: tenant.id,
      actorUserId,
      action: 'maintenance_plan_delete',
      vehicleId,
      meta: { itemId, title: row.title },
    });
  }
}
