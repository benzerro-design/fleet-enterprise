import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  Prisma,
  RsaEnrollmentStatus,
  type RoadsideInterventionKind,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertClientAccess,
  assertClientFleetWrite,
  isDriverOnlyClientUser,
  isTenantWideAccess,
} from '../iam/client-access';
import { accessAllowsCapability } from '../iam/functional-profile';
import {
  assertPartnerSupplierId,
  assertPartnerWrite,
  isPartnerUser,
} from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { hashBrokerSecretForStorage } from './rsa-broker-crypto';

const DEFAULT_KINDS: RoadsideInterventionKind[] = [
  'tow',
  'jump_start',
  'tire_change',
  'lockout',
  'fuel_delivery',
  'other',
];

const DEFAULT_FEATURES: Record<string, boolean> = {
  tow: true,
  jump_start: true,
  tire_change: true,
  lockout: true,
  fuel_delivery: true,
  other: false,
};

export type RsaSupplierProfileRecord = {
  id: string;
  supplierId: string;
  is24x7: boolean;
  dispatchPhone24x7: string | null;
  dispatchEmail: string | null;
  coverageCounties: string[];
  crossBorderEnabled: boolean;
  supportedKinds: string[];
  slaAckMinutes: number;
  slaArrivalUrbanMinutes: number;
  slaArrivalHighwayMinutes: number;
  baseCalloutOutPlanCents: number;
  towHookOutPlanCents: number;
  towPerKmOutPlanCents: number;
  winchSurchargeCents: number;
  nightWeekendMultiplierPct: number;
  brokerOutboundEnabled: boolean;
  brokerApiBaseUrl: string | null;
  brokerApiKeyLast4: string | null;
  brokerInboundEnabled: boolean;
  brokerInboundSecretLast4: string | null;
  brokerAutoDispatch: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertRsaSupplierProfileInput = {
  is24x7?: boolean;
  dispatchPhone24x7?: string | null;
  dispatchEmail?: string | null;
  coverageCounties?: string[];
  crossBorderEnabled?: boolean;
  supportedKinds?: string[];
  slaAckMinutes?: number;
  slaArrivalUrbanMinutes?: number;
  slaArrivalHighwayMinutes?: number;
  baseCalloutOutPlanCents?: number;
  towHookOutPlanCents?: number;
  towPerKmOutPlanCents?: number;
  winchSurchargeCents?: number;
  nightWeekendMultiplierPct?: number;
  brokerOutboundEnabled?: boolean;
  brokerApiBaseUrl?: string | null;
  /** Write-only — sealed at rest. Empty string clears. */
  brokerApiKey?: string | null;
  brokerInboundEnabled?: boolean;
  /** Write-only inbound webhook secret. Empty string clears. */
  brokerInboundSecret?: string | null;
  brokerAutoDispatch?: boolean;
};

export type RsaPlanRecord = {
  id: string;
  supplierId: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  monthlyFeePerVehicleCents: number;
  features: Record<string, boolean>;
  includedTowKm: number;
  maxInterventionsPerYear: number | null;
  overagePerKmCents: number;
  mobilityIncluded: boolean;
  mobilityMaxDays: number | null;
  mobilityTriggerHours: number | null;
  mobilityVehicleClass: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRsaPlanInput = {
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
  monthlyFeePerVehicleCents?: number;
  features?: Record<string, boolean>;
  includedTowKm?: number;
  maxInterventionsPerYear?: number | null;
  overagePerKmCents?: number;
  mobilityIncluded?: boolean;
  mobilityMaxDays?: number | null;
  mobilityTriggerHours?: number | null;
  mobilityVehicleClass?: string | null;
};

export type PatchRsaPlanInput = Partial<CreateRsaPlanInput>;

export type RsaEnrollmentRecord = {
  id: string;
  clientId: string;
  clientLegalName: string;
  vehicleId: string;
  vehicleReg: string | null;
  planId: string;
  planCode: string;
  planName: string;
  supplierId: string;
  supplierLegalName: string;
  status: RsaEnrollmentStatus;
  externalSubscriptionNo: string | null;
  validFrom: string;
  validUntil: string | null;
  interventionsUsedCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRsaEnrollmentInput = {
  vehicleId: string;
  planId: string;
  status?: RsaEnrollmentStatus;
  externalSubscriptionNo?: string | null;
  validFrom: string;
  validUntil?: string | null;
  notes?: string | null;
};

export type PatchRsaEnrollmentInput = {
  status?: RsaEnrollmentStatus;
  externalSubscriptionNo?: string | null;
  validFrom?: string;
  validUntil?: string | null;
  notes?: string | null;
  interventionsUsedCount?: number;
};

export type RsaEnrollmentListParams = {
  page: number;
  pageSize: number;
  vehicleId?: string;
  clientId?: string;
  supplierId?: string;
  status?: RsaEnrollmentStatus;
};

type EnrollmentRow = Prisma.RsaVehicleEnrollmentGetPayload<{
  include: {
    client: { select: { legalName: true } };
    vehicle: { select: { registrationNumber: true } };
    plan: { select: { code: true; name: true } };
    supplier: { select: { legalName: true } };
  };
}>;

function asStringArray(value: Prisma.JsonValue | null | undefined, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((v): v is string => typeof v === 'string');
}

function asFeatures(
  value: Prisma.JsonValue | null | undefined,
): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_FEATURES };
  }
  const out: Record<string, boolean> = { ...DEFAULT_FEATURES };
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function parseDateOnly(raw: string, field: string): Date {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD`);
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return d;
}

function dateOnlyIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class RsaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toProfile(
    row: {
      id: string;
      supplierId: string;
      is24x7: boolean;
      dispatchPhone24x7: string | null;
      dispatchEmail: string | null;
      coverageCountiesJson: Prisma.JsonValue;
      crossBorderEnabled: boolean;
      supportedKindsJson: Prisma.JsonValue;
      slaAckMinutes: number;
      slaArrivalUrbanMinutes: number;
      slaArrivalHighwayMinutes: number;
      baseCalloutOutPlanCents: number;
      towHookOutPlanCents: number;
      towPerKmOutPlanCents: number;
      winchSurchargeCents: number;
      nightWeekendMultiplierPct: number;
      brokerOutboundEnabled: boolean;
      brokerApiBaseUrl: string | null;
      brokerApiKeyLast4: string | null;
      brokerInboundEnabled: boolean;
      brokerInboundSecretLast4: string | null;
      brokerAutoDispatch: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
  ): RsaSupplierProfileRecord {
    return {
      id: row.id,
      supplierId: row.supplierId,
      is24x7: row.is24x7,
      dispatchPhone24x7: row.dispatchPhone24x7,
      dispatchEmail: row.dispatchEmail,
      coverageCounties: asStringArray(row.coverageCountiesJson, []),
      crossBorderEnabled: row.crossBorderEnabled,
      supportedKinds: asStringArray(row.supportedKindsJson, DEFAULT_KINDS),
      slaAckMinutes: row.slaAckMinutes,
      slaArrivalUrbanMinutes: row.slaArrivalUrbanMinutes,
      slaArrivalHighwayMinutes: row.slaArrivalHighwayMinutes,
      baseCalloutOutPlanCents: row.baseCalloutOutPlanCents,
      towHookOutPlanCents: row.towHookOutPlanCents,
      towPerKmOutPlanCents: row.towPerKmOutPlanCents,
      winchSurchargeCents: row.winchSurchargeCents,
      nightWeekendMultiplierPct: row.nightWeekendMultiplierPct,
      brokerOutboundEnabled: row.brokerOutboundEnabled,
      brokerApiBaseUrl: row.brokerApiBaseUrl,
      brokerApiKeyLast4: row.brokerApiKeyLast4,
      brokerInboundEnabled: row.brokerInboundEnabled,
      brokerInboundSecretLast4: row.brokerInboundSecretLast4,
      brokerAutoDispatch: row.brokerAutoDispatch,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPlan(row: {
    id: string;
    supplierId: string;
    code: string;
    name: string;
    description: string | null;
    active: boolean;
    monthlyFeePerVehicleCents: number;
    featuresJson: Prisma.JsonValue;
    includedTowKm: number;
    maxInterventionsPerYear: number | null;
    overagePerKmCents: number;
    mobilityIncluded: boolean;
    mobilityMaxDays: number | null;
    mobilityTriggerHours: number | null;
    mobilityVehicleClass: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): RsaPlanRecord {
    return {
      id: row.id,
      supplierId: row.supplierId,
      code: row.code,
      name: row.name,
      description: row.description,
      active: row.active,
      monthlyFeePerVehicleCents: row.monthlyFeePerVehicleCents,
      features: asFeatures(row.featuresJson),
      includedTowKm: row.includedTowKm,
      maxInterventionsPerYear: row.maxInterventionsPerYear,
      overagePerKmCents: row.overagePerKmCents,
      mobilityIncluded: row.mobilityIncluded,
      mobilityMaxDays: row.mobilityMaxDays,
      mobilityTriggerHours: row.mobilityTriggerHours,
      mobilityVehicleClass: row.mobilityVehicleClass,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toEnrollment(row: EnrollmentRow): RsaEnrollmentRecord {
    return {
      id: row.id,
      clientId: row.clientId,
      clientLegalName: row.client.legalName,
      vehicleId: row.vehicleId,
      vehicleReg: row.vehicle.registrationNumber,
      planId: row.planId,
      planCode: row.plan.code,
      planName: row.plan.name,
      supplierId: row.supplierId,
      supplierLegalName: row.supplier.legalName,
      status: row.status,
      externalSubscriptionNo: row.externalSubscriptionNo,
      validFrom: dateOnlyIso(row.validFrom),
      validUntil: row.validUntil ? dateOnlyIso(row.validUntil) : null,
      interventionsUsedCount: row.interventionsUsedCount,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private enrollmentInclude() {
    return {
      client: { select: { legalName: true } },
      vehicle: { select: { registrationNumber: true } },
      plan: { select: { code: true, name: true } },
      supplier: { select: { legalName: true } },
    } as const;
  }

  private async requireRoadsideSupplier(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, category: 'roadside_assistance' },
      select: { id: true },
    });
    if (!supplier) {
      throw new BadRequestException('supplierId must be a roadside_assistance supplier');
    }
    return supplier;
  }

  private assertSupplierRead(access: AccessContext | undefined, supplierId: string) {
    if (!access) return;
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, supplierId);
      return;
    }
    if (!isTenantWideAccess(access) && access.allowedClientIds.length === 0) {
      throw new ForbiddenException('Access denied');
    }
  }

  private assertSupplierWrite(access: AccessContext | undefined, supplierId: string) {
    if (!access) return;
    if (isPartnerUser(access)) {
      assertPartnerSupplierId(access, supplierId);
      assertPartnerWrite(access);
      return;
    }
    if (!isTenantWideAccess(access)) {
      throw new ForbiddenException('Only fleet or partner managers can edit RSA profile');
    }
    if (access.membershipRole !== MembershipRole.tenant_admin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (!accessAllowsCapability(access, 'fleet.write')) {
      throw new ForbiddenException('Insufficient permissions for fleet write (profil F/T/G)');
    }
  }

  async getProfile(
    tenantSlug: string,
    supplierId: string,
    access?: AccessContext,
  ): Promise<RsaSupplierProfileRecord | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.requireRoadsideSupplier(tenant.id, supplierId);
    this.assertSupplierRead(access, supplierId);

    const row = await this.prisma.rsaSupplierProfile.findFirst({
      where: { tenantId: tenant.id, supplierId },
    });
    return row ? this.toProfile(row) : null;
  }

  async upsertProfile(
    tenantSlug: string,
    supplierId: string,
    input: UpsertRsaSupplierProfileInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaSupplierProfileRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.requireRoadsideSupplier(tenant.id, supplierId);
    this.assertSupplierWrite(access, supplierId);

    const existing = await this.prisma.rsaSupplierProfile.findFirst({
      where: { tenantId: tenant.id, supplierId },
    });

    const createData = {
      is24x7: input.is24x7 ?? true,
      dispatchPhone24x7:
        input.dispatchPhone24x7 !== undefined
          ? input.dispatchPhone24x7?.trim() || null
          : null,
      dispatchEmail:
        input.dispatchEmail !== undefined ? input.dispatchEmail?.trim() || null : null,
      coverageCountiesJson: (input.coverageCounties ?? []) as Prisma.InputJsonValue,
      crossBorderEnabled: input.crossBorderEnabled ?? false,
      supportedKindsJson: (input.supportedKinds ?? DEFAULT_KINDS) as Prisma.InputJsonValue,
      slaAckMinutes: input.slaAckMinutes ?? 10,
      slaArrivalUrbanMinutes: input.slaArrivalUrbanMinutes ?? 45,
      slaArrivalHighwayMinutes: input.slaArrivalHighwayMinutes ?? 60,
      baseCalloutOutPlanCents: input.baseCalloutOutPlanCents ?? 0,
      towHookOutPlanCents: input.towHookOutPlanCents ?? 0,
      towPerKmOutPlanCents: input.towPerKmOutPlanCents ?? 0,
      winchSurchargeCents: input.winchSurchargeCents ?? 0,
      nightWeekendMultiplierPct: input.nightWeekendMultiplierPct ?? 0,
      brokerOutboundEnabled: input.brokerOutboundEnabled ?? false,
      brokerApiBaseUrl:
        input.brokerApiBaseUrl !== undefined
          ? input.brokerApiBaseUrl?.trim() || null
          : null,
      brokerAutoDispatch: input.brokerAutoDispatch ?? false,
      brokerInboundEnabled: input.brokerInboundEnabled ?? false,
      ...(() => {
        const out: {
          brokerApiKeySealed?: string | null;
          brokerApiKeyLast4?: string | null;
          brokerInboundSecretHash?: string | null;
          brokerInboundSecretLast4?: string | null;
        } = {};
        if (input.brokerApiKey !== undefined) {
          if (!input.brokerApiKey?.trim()) {
            out.brokerApiKeySealed = null;
            out.brokerApiKeyLast4 = null;
          } else {
            const s = hashBrokerSecretForStorage(input.brokerApiKey);
            out.brokerApiKeySealed = s.sealed;
            out.brokerApiKeyLast4 = s.last4;
          }
        }
        if (input.brokerInboundSecret !== undefined) {
          if (!input.brokerInboundSecret?.trim()) {
            out.brokerInboundSecretHash = null;
            out.brokerInboundSecretLast4 = null;
          } else {
            const s = hashBrokerSecretForStorage(input.brokerInboundSecret);
            out.brokerInboundSecretHash = s.hash;
            out.brokerInboundSecretLast4 = s.last4;
          }
        }
        return out;
      })(),
    };

    const updateData: Prisma.RsaSupplierProfileUncheckedUpdateInput = {};
    if (input.is24x7 !== undefined) updateData.is24x7 = input.is24x7;
    if (input.dispatchPhone24x7 !== undefined) {
      updateData.dispatchPhone24x7 = input.dispatchPhone24x7?.trim() || null;
    }
    if (input.dispatchEmail !== undefined) {
      updateData.dispatchEmail = input.dispatchEmail?.trim() || null;
    }
    if (input.coverageCounties !== undefined) {
      updateData.coverageCountiesJson = input.coverageCounties as Prisma.InputJsonValue;
    }
    if (input.crossBorderEnabled !== undefined) {
      updateData.crossBorderEnabled = input.crossBorderEnabled;
    }
    if (input.supportedKinds !== undefined) {
      updateData.supportedKindsJson = input.supportedKinds as Prisma.InputJsonValue;
    }
    if (input.slaAckMinutes !== undefined) updateData.slaAckMinutes = input.slaAckMinutes;
    if (input.slaArrivalUrbanMinutes !== undefined) {
      updateData.slaArrivalUrbanMinutes = input.slaArrivalUrbanMinutes;
    }
    if (input.slaArrivalHighwayMinutes !== undefined) {
      updateData.slaArrivalHighwayMinutes = input.slaArrivalHighwayMinutes;
    }
    if (input.baseCalloutOutPlanCents !== undefined) {
      updateData.baseCalloutOutPlanCents = input.baseCalloutOutPlanCents;
    }
    if (input.towHookOutPlanCents !== undefined) {
      updateData.towHookOutPlanCents = input.towHookOutPlanCents;
    }
    if (input.towPerKmOutPlanCents !== undefined) {
      updateData.towPerKmOutPlanCents = input.towPerKmOutPlanCents;
    }
    if (input.winchSurchargeCents !== undefined) {
      updateData.winchSurchargeCents = input.winchSurchargeCents;
    }
    if (input.nightWeekendMultiplierPct !== undefined) {
      updateData.nightWeekendMultiplierPct = input.nightWeekendMultiplierPct;
    }
    if (input.brokerOutboundEnabled !== undefined) {
      updateData.brokerOutboundEnabled = input.brokerOutboundEnabled;
    }
    if (input.brokerApiBaseUrl !== undefined) {
      updateData.brokerApiBaseUrl = input.brokerApiBaseUrl?.trim() || null;
    }
    if (input.brokerAutoDispatch !== undefined) {
      updateData.brokerAutoDispatch = input.brokerAutoDispatch;
    }
    if (input.brokerInboundEnabled !== undefined) {
      updateData.brokerInboundEnabled = input.brokerInboundEnabled;
    }
    if (input.brokerApiKey !== undefined) {
      if (!input.brokerApiKey?.trim()) {
        updateData.brokerApiKeySealed = null;
        updateData.brokerApiKeyLast4 = null;
      } else {
        const s = hashBrokerSecretForStorage(input.brokerApiKey);
        updateData.brokerApiKeySealed = s.sealed;
        updateData.brokerApiKeyLast4 = s.last4;
      }
    }
    if (input.brokerInboundSecret !== undefined) {
      if (!input.brokerInboundSecret?.trim()) {
        updateData.brokerInboundSecretHash = null;
        updateData.brokerInboundSecretLast4 = null;
      } else {
        const s = hashBrokerSecretForStorage(input.brokerInboundSecret);
        updateData.brokerInboundSecretHash = s.hash;
        updateData.brokerInboundSecretLast4 = s.last4;
      }
    }

    const row = existing
      ? await this.prisma.rsaSupplierProfile.update({
          where: { supplierId },
          data: updateData,
        })
      : await this.prisma.rsaSupplierProfile.create({
          data: {
            tenantId: tenant.id,
            supplierId,
            ...createData,
          },
        });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_supplier_profile.upsert',
      entityType: 'rsa_supplier_profile',
      entityId: row.id,
      meta: { supplierId },
    });

    return this.toProfile(row);
  }

  async listPlans(
    tenantSlug: string,
    supplierId: string,
    access?: AccessContext,
  ): Promise<{ items: RsaPlanRecord[] }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return { items: [] };
    await this.requireRoadsideSupplier(tenant.id, supplierId);
    this.assertSupplierRead(access, supplierId);

    const rows = await this.prisma.rsaPlan.findMany({
      where: { tenantId: tenant.id, supplierId },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
    return { items: rows.map((r) => this.toPlan(r)) };
  }

  async createPlan(
    tenantSlug: string,
    supplierId: string,
    input: CreateRsaPlanInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaPlanRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.requireRoadsideSupplier(tenant.id, supplierId);
    this.assertSupplierWrite(access, supplierId);

    const code = input.code?.trim();
    const name = input.name?.trim();
    if (!code || !name) throw new BadRequestException('code and name are required');

    try {
      const row = await this.prisma.rsaPlan.create({
        data: {
          tenantId: tenant.id,
          supplierId,
          code,
          name,
          description: input.description?.trim() || null,
          active: input.active ?? true,
          monthlyFeePerVehicleCents: input.monthlyFeePerVehicleCents ?? 0,
          featuresJson: (input.features ?? DEFAULT_FEATURES) as Prisma.InputJsonValue,
          includedTowKm: input.includedTowKm ?? 100,
          maxInterventionsPerYear: input.maxInterventionsPerYear ?? null,
          overagePerKmCents: input.overagePerKmCents ?? 0,
          mobilityIncluded: input.mobilityIncluded ?? false,
          mobilityMaxDays: input.mobilityMaxDays ?? null,
          mobilityTriggerHours: input.mobilityTriggerHours ?? 0,
          mobilityVehicleClass: input.mobilityVehicleClass?.trim() || null,
        },
      });

      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'rsa_plan.create',
        entityType: 'rsa_plan',
        entityId: row.id,
        meta: { supplierId, code },
      });

      return this.toPlan(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Plan code already exists');
      }
      throw e;
    }
  }

  async patchPlan(
    tenantSlug: string,
    planId: string,
    input: PatchRsaPlanInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaPlanRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Plan not found');

    const existing = await this.prisma.rsaPlan.findFirst({
      where: { id: planId, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Plan not found');
    this.assertSupplierWrite(access, existing.supplierId);

    const data: Prisma.RsaPlanUncheckedUpdateInput = {};
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (!code) throw new BadRequestException('code is required');
      data.code = code;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('name is required');
      data.name = name;
    }
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.active !== undefined) data.active = input.active;
    if (input.monthlyFeePerVehicleCents !== undefined) {
      data.monthlyFeePerVehicleCents = input.monthlyFeePerVehicleCents;
    }
    if (input.features !== undefined) {
      data.featuresJson = input.features as Prisma.InputJsonValue;
    }
    if (input.includedTowKm !== undefined) data.includedTowKm = input.includedTowKm;
    if (input.maxInterventionsPerYear !== undefined) {
      data.maxInterventionsPerYear = input.maxInterventionsPerYear;
    }
    if (input.overagePerKmCents !== undefined) data.overagePerKmCents = input.overagePerKmCents;
    if (input.mobilityIncluded !== undefined) data.mobilityIncluded = input.mobilityIncluded;
    if (input.mobilityMaxDays !== undefined) data.mobilityMaxDays = input.mobilityMaxDays;
    if (input.mobilityTriggerHours !== undefined) {
      data.mobilityTriggerHours = input.mobilityTriggerHours;
    }
    if (input.mobilityVehicleClass !== undefined) {
      data.mobilityVehicleClass = input.mobilityVehicleClass?.trim() || null;
    }

    try {
      const row = await this.prisma.rsaPlan.update({ where: { id: planId }, data });
      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'rsa_plan.patch',
        entityType: 'rsa_plan',
        entityId: planId,
        meta: input,
      });
      return this.toPlan(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Plan code already exists');
      }
      throw e;
    }
  }

  private enrollmentScope(
    access: AccessContext | undefined,
  ): Prisma.RsaVehicleEnrollmentWhereInput | null {
    if (!access) return {};
    if (isTenantWideAccess(access)) return {};
    if (isPartnerUser(access)) {
      const ids = access.allowedSupplierIds;
      if (ids.length === 0) return null;
      return { supplierId: { in: ids } };
    }
    if (access.allowedClientIds.length === 0) return null;
    if (isDriverOnlyClientUser(access)) {
      const ids = access.assignedVehicleIds ?? [];
      if (ids.length === 0) return null;
      return { vehicleId: { in: ids } };
    }
    return { clientId: { in: access.allowedClientIds } };
  }

  async listEnrollments(
    tenantSlug: string,
    params: RsaEnrollmentListParams,
    access?: AccessContext,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }

    const scope = this.enrollmentScope(access);
    if (scope === null) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }

    const parts: Prisma.RsaVehicleEnrollmentWhereInput[] = [{ tenantId: tenant.id }, scope];
    if (params.vehicleId) parts.push({ vehicleId: params.vehicleId });
    if (params.clientId) {
      if (access && !isTenantWideAccess(access) && !isPartnerUser(access)) {
        assertClientAccess(access, params.clientId);
      }
      parts.push({ clientId: params.clientId });
    }
    if (params.supplierId) {
      if (access && isPartnerUser(access)) {
        assertPartnerSupplierId(access, params.supplierId);
      }
      parts.push({ supplierId: params.supplierId });
    }
    if (params.status) parts.push({ status: params.status });

    const pageSize = Math.min(Math.max(1, params.pageSize), 200);
    const page = Math.max(1, params.page);
    const where: Prisma.RsaVehicleEnrollmentWhereInput = { AND: parts };

    const [total, rows] = await Promise.all([
      this.prisma.rsaVehicleEnrollment.count({ where }),
      this.prisma.rsaVehicleEnrollment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.enrollmentInclude(),
      }),
    ]);

    return {
      items: rows.map((r) => this.toEnrollment(r)),
      total,
      page,
      pageSize,
    };
  }

  async createEnrollment(
    tenantSlug: string,
    input: CreateRsaEnrollmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaEnrollmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId: tenant.id },
      select: { id: true, clientId: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    if (access) {
      if (isPartnerUser(access)) {
        throw new ForbiddenException('Partners cannot create enrollments in S0');
      }
      assertClientFleetWrite(access, vehicle.clientId);
    }

    const plan = await this.prisma.rsaPlan.findFirst({
      where: { id: input.planId, tenantId: tenant.id, active: true },
    });
    if (!plan) throw new BadRequestException('Active RSA plan required');

    const status: RsaEnrollmentStatus = input.status ?? RsaEnrollmentStatus.active;
    const validFrom = parseDateOnly(input.validFrom, 'validFrom');
    const validUntil = input.validUntil
      ? parseDateOnly(input.validUntil, 'validUntil')
      : null;
    if (validUntil && validUntil < validFrom) {
      throw new BadRequestException('validUntil must be on or after validFrom');
    }

    if (status === RsaEnrollmentStatus.active || status === RsaEnrollmentStatus.pending_sync) {
      const overlap = await this.prisma.rsaVehicleEnrollment.findFirst({
        where: {
          tenantId: tenant.id,
          vehicleId: vehicle.id,
          supplierId: plan.supplierId,
          status: { in: [RsaEnrollmentStatus.active, RsaEnrollmentStatus.pending_sync] },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new BadRequestException(
          'Vehicle already has an active enrollment with this RSA supplier',
        );
      }
    }

    const row = await this.prisma.rsaVehicleEnrollment.create({
      data: {
        tenantId: tenant.id,
        clientId: vehicle.clientId,
        vehicleId: vehicle.id,
        planId: plan.id,
        supplierId: plan.supplierId,
        status,
        externalSubscriptionNo: input.externalSubscriptionNo?.trim() || null,
        validFrom,
        validUntil,
        notes: input.notes?.trim() || null,
      },
      include: this.enrollmentInclude(),
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_enrollment.create',
      entityType: 'rsa_vehicle_enrollment',
      entityId: row.id,
      meta: { vehicleId: vehicle.id, planId: plan.id },
    });

    return this.toEnrollment(row);
  }

  async patchEnrollment(
    tenantSlug: string,
    id: string,
    input: PatchRsaEnrollmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<RsaEnrollmentRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Enrollment not found');

    const existing = await this.prisma.rsaVehicleEnrollment.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Enrollment not found');

    if (access) {
      if (isPartnerUser(access)) {
        assertPartnerSupplierId(access, existing.supplierId);
        assertPartnerWrite(access);
        // Partner S0: doar status / note
        if (
          input.validFrom !== undefined ||
          input.validUntil !== undefined ||
          input.interventionsUsedCount !== undefined ||
          input.externalSubscriptionNo !== undefined
        ) {
          throw new ForbiddenException('Partner cannot change enrollment dates/usage in S0');
        }
      } else {
        assertClientFleetWrite(access, existing.clientId);
      }
    }

    const data: Prisma.RsaVehicleEnrollmentUncheckedUpdateInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.externalSubscriptionNo !== undefined) {
      data.externalSubscriptionNo = input.externalSubscriptionNo?.trim() || null;
    }
    if (input.validFrom !== undefined) {
      data.validFrom = parseDateOnly(input.validFrom, 'validFrom');
    }
    if (input.validUntil !== undefined) {
      data.validUntil = input.validUntil
        ? parseDateOnly(input.validUntil, 'validUntil')
        : null;
    }
    const nextFrom =
      input.validFrom !== undefined
        ? parseDateOnly(input.validFrom, 'validFrom')
        : existing.validFrom;
    const nextUntil =
      input.validUntil !== undefined
        ? input.validUntil
          ? parseDateOnly(input.validUntil, 'validUntil')
          : null
        : existing.validUntil;
    if (nextUntil && nextUntil < nextFrom) {
      throw new BadRequestException('validUntil must be on or after validFrom');
    }
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.interventionsUsedCount !== undefined) {
      data.interventionsUsedCount = input.interventionsUsedCount;
    }

    const row = await this.prisma.rsaVehicleEnrollment.update({
      where: { id },
      data,
      include: this.enrollmentInclude(),
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'rsa_enrollment.patch',
      entityType: 'rsa_vehicle_enrollment',
      entityId: id,
      meta: input,
    });

    return this.toEnrollment(row);
  }
}
