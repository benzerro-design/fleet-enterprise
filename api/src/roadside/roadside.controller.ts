import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  Prisma,
  RoadsideInterventionKind,
  RoadsideInterventionStatus,
  RsaEnrollmentStatus,
  RsaHandoverKind,
  RsaHandoverMediaKind,
  RsaHandoverSignerRole,
  RsaMissionStatus,
} from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import type {
  CreateRoadsideInterventionInput,
  PatchRoadsideInterventionInput,
} from './roadside.service';
import { RoadsideService } from './roadside.service';
import type {
  CreateRsaEnrollmentInput,
  CreateRsaPlanInput,
  PatchRsaEnrollmentInput,
  PatchRsaPlanInput,
  UpsertRsaSupplierProfileInput,
} from './rsa.service';
import { RsaService } from './rsa.service';
import { RsaMissionService } from './rsa-mission.service';
import { RsaBrokerService } from './rsa-broker.service';

function parseStatus(raw?: string): RoadsideInterventionStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as RoadsideInterventionStatus;
  if (
    v === 'draft' ||
    v === 'requested' ||
    v === 'dispatched' ||
    v === 'on_site' ||
    v === 'completed' ||
    v === 'cancelled'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid status');
}

function parseKind(raw?: string): RoadsideInterventionKind | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as RoadsideInterventionKind;
  if (
    v === 'tow' ||
    v === 'jump_start' ||
    v === 'tire_change' ||
    v === 'lockout' ||
    v === 'fuel_delivery' ||
    v === 'other'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid kind');
}

function parseEnrollmentStatus(raw?: string): RsaEnrollmentStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as RsaEnrollmentStatus;
  if (
    v === 'pending_sync' ||
    v === 'active' ||
    v === 'suspended' ||
    v === 'expired' ||
    v === 'cancelled'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid enrollment status');
}

function parseMissionStatus(raw?: string): RsaMissionStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as RsaMissionStatus;
  if (
    v === 'assigned' ||
    v === 'en_route' ||
    v === 'on_scene' ||
    v === 'picked_up' ||
    v === 'in_transit' ||
    v === 'delivered' ||
    v === 'closed' ||
    v === 'cancelled'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid mission status');
}

function parseHandoverKind(raw?: string): RsaHandoverKind {
  const v = (raw ?? '').trim() as RsaHandoverKind;
  if (v === 'pickup' || v === 'dropoff') return v;
  throw new BadRequestException('kind must be pickup or dropoff');
}

@Controller('roadside')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoadsideController {
  constructor(
    private readonly roadside: RoadsideService,
    private readonly rsa: RsaService,
    private readonly missions: RsaMissionService,
    private readonly broker: RsaBrokerService,
  ) {}

  @Get('entitlement')
  @Roles(...FLEET_READ_ROLES)
  entitlement(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('kind') kindRaw?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('clientId') clientId?: string,
  ) {
    const kind = parseKind(kindRaw);
    if (!kind) throw new BadRequestException('kind is required');
    return this.roadside.resolveEntitlement(
      tenantSlug,
      {
        kind,
        vehicleId: vehicleId?.trim(),
        supplierId: supplierId?.trim(),
        clientId: clientId?.trim(),
      },
      access,
    );
  }

  @Get('interventions')
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('serviceCaseId') serviceCaseId?: string,
    @Query('ticketId') ticketId?: string,
    @Query('workOrderId') workOrderId?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.roadside.listPaged(
      tenantSlug,
      {
        page,
        pageSize,
        serviceCaseId: serviceCaseId?.trim(),
        ticketId: ticketId?.trim(),
        workOrderId: workOrderId?.trim(),
        status: parseStatus(status),
        kind: parseKind(kind),
      },
      access,
    );
  }

  @Get('interventions/:id')
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.roadside.getById(tenantSlug, id, access);
  }

  @Post('interventions')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateRoadsideInterventionInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    if (body.kind) parseKind(body.kind);
    if (body.status) parseStatus(body.status);
    return this.roadside.create(tenantSlug, body, actorUserId, access);
  }

  @Patch('interventions/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchRoadsideInterventionInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    if (body.kind) parseKind(body.kind);
    if (body.status) parseStatus(body.status);
    return this.roadside.patch(tenantSlug, id, body, actorUserId, access);
  }

  // ——— RSA-S0: profile / plans / enrollments ———

  @Get('suppliers/:supplierId/profile')
  @Roles(...FLEET_READ_ROLES)
  getProfile(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.rsa.getProfile(tenantSlug, supplierId, access);
  }

  @Put('suppliers/:supplierId/profile')
  @Roles(...FLEET_WRITE_ROLES)
  upsertProfile(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @Body() body: UpsertRsaSupplierProfileInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.rsa.upsertProfile(tenantSlug, supplierId, body, actorUserId, access);
  }

  @Get('suppliers/:supplierId/plans')
  @Roles(...FLEET_READ_ROLES)
  listPlans(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.rsa.listPlans(tenantSlug, supplierId, access);
  }

  @Post('suppliers/:supplierId/plans')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createPlan(
    @TenantId() tenantSlug: string,
    @Param('supplierId') supplierId: string,
    @Body() body: CreateRsaPlanInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.rsa.createPlan(tenantSlug, supplierId, body, actorUserId, access);
  }

  @Patch('plans/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchPlan(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchRsaPlanInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.rsa.patchPlan(tenantSlug, id, body, actorUserId, access);
  }

  @Get('enrollments')
  @Roles(...FLEET_READ_ROLES)
  listEnrollments(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('clientId') clientId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.rsa.listEnrollments(
      tenantSlug,
      {
        page,
        pageSize,
        vehicleId: vehicleId?.trim(),
        clientId: clientId?.trim(),
        supplierId: supplierId?.trim(),
        status: parseEnrollmentStatus(status),
      },
      access,
    );
  }

  @Post('enrollments')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createEnrollment(
    @TenantId() tenantSlug: string,
    @Body() body: CreateRsaEnrollmentInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    if (body.status) parseEnrollmentStatus(body.status);
    return this.rsa.createEnrollment(tenantSlug, body, actorUserId, access);
  }

  @Patch('enrollments/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchEnrollment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchRsaEnrollmentInput,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    if (body.status) parseEnrollmentStatus(body.status);
    return this.rsa.patchEnrollment(tenantSlug, id, body, actorUserId, access);
  }

  // ——— RSA-S2 / S2b: missions + handover ———

  @Get('missions')
  @Roles(...FLEET_READ_ROLES)
  listMissions(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('interventionId') interventionId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 100);
    return this.missions.listMissions(
      tenantSlug,
      {
        page,
        pageSize,
        status: parseMissionStatus(status),
        supplierId: supplierId?.trim(),
        interventionId: interventionId?.trim(),
      },
      access,
    );
  }

  @Get('missions/:id')
  @Roles(...FLEET_READ_ROLES)
  getMission(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.missions.getMission(tenantSlug, id, access);
  }

  @Post('missions')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createMission(
    @TenantId() tenantSlug: string,
    @Body()
    body: {
      interventionId: string;
      driverUserId?: string | null;
      driverDisplayName?: string | null;
      platformPlate?: string | null;
      pickupLocationText?: string | null;
      dropoffLocationText?: string | null;
      etaMinutes?: number | null;
      notes?: string | null;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.createMission(tenantSlug, body, actorUserId, access);
  }

  @Patch('missions/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchMission(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      status?: RsaMissionStatus;
      driverUserId?: string | null;
      driverDisplayName?: string | null;
      platformPlate?: string | null;
      pickupLocationText?: string | null;
      dropoffLocationText?: string | null;
      etaMinutes?: number | null;
      notes?: string | null;
      cancelReason?: string | null;
      distanceKm?: number | null;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    if (body.status) parseMissionStatus(body.status);
    return this.missions.patchMission(tenantSlug, id, body, actorUserId, access);
  }

  /** RSA-S4 — preview decont (fără scriere). */
  @Get('missions/:id/settlement')
  @Roles(...FLEET_READ_ROLES)
  previewSettlement(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
    @Query('distanceKm') distanceKmStr?: string,
    @Query('applyNightWeekend') applyNightWeekend?: string,
    @Query('applyWinch') applyWinch?: string,
  ) {
    const distanceKm =
      distanceKmStr !== undefined && distanceKmStr !== ''
        ? Number(distanceKmStr)
        : undefined;
    return this.missions.previewSettlement(
      tenantSlug,
      id,
      {
        distanceKm: distanceKm !== undefined && Number.isFinite(distanceKm) ? distanceKm : undefined,
        applyNightWeekend: applyNightWeekend === '1' || applyNightWeekend === 'true',
        applyWinch: applyWinch === '1' || applyWinch === 'true',
      },
      access,
    );
  }

  /** RSA-S4 — creează CostEntry (idempotent). */
  @Post('missions/:id/settle')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(200)
  settleMission(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      distanceKm?: number | null;
      applyNightWeekend?: boolean;
      applyWinch?: boolean;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.settleMission(tenantSlug, id, body ?? {}, actorUserId, access);
  }

  @Post('missions/:id/protocols/:kind')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  openProtocol(
    @TenantId() tenantSlug: string,
    @Param('id') missionId: string,
    @Param('kind') kindRaw: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.getOrCreateProtocol(
      tenantSlug,
      missionId,
      parseHandoverKind(kindRaw),
      access,
    );
  }

  @Get('protocols/:id')
  @Roles(...FLEET_READ_ROLES)
  getProtocol(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.missions.getProtocol(tenantSlug, id, access);
  }

  @Patch('protocols/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchProtocol(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      locationText?: string | null;
      odometerKm?: number | null;
      fuelLevelPct?: number | null;
      damageNotes?: string | null;
      inventoryNotes?: string | null;
      checklist?: Record<string, boolean>;
      counterpartyName?: string | null;
      counterpartyRoleNote?: string | null;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.patchProtocol(tenantSlug, id, body, actorUserId, access);
  }

  @Post('protocols/:id/signatures')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  addSignature(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      role: RsaHandoverSignerRole;
      displayName: string;
      signaturePngUrl: string;
      strokePathJson?: Prisma.InputJsonValue | null;
      deviceMetaJson?: Prisma.InputJsonValue | null;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.addSignature(tenantSlug, id, body, actorUserId, access);
  }

  @Post('protocols/:id/media')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  addMedia(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      kind: RsaHandoverMediaKind;
      fileUrl: string;
      fileName?: string | null;
      caption?: string | null;
    },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.addMedia(tenantSlug, id, body, actorUserId, access);
  }

  @Post('protocols/:id/finalize')
  @Roles(...FLEET_WRITE_ROLES)
  finalizeProtocol(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.missions.finalizeProtocol(tenantSlug, id, actorUserId, access);
  }

  @Get('protocols/:id/pdf')
  @Roles(...FLEET_READ_ROLES)
  @Header('Content-Type', 'application/pdf')
  protocolPdf(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.missions.downloadProtocolPdf(tenantSlug, id, access);
  }

  // ——— RSA-S5: broker ———

  @Post('interventions/:id/broker-dispatch')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(200)
  brokerDispatch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.broker.dispatchIntervention(tenantSlug, id, actorUserId, access);
  }

  @Get('broker/events')
  @Roles(...FLEET_READ_ROLES)
  listBrokerEvents(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('supplierId') supplierId?: string,
    @Query('interventionId') interventionId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 100);
    return this.broker.listEvents(
      tenantSlug,
      {
        page,
        pageSize,
        supplierId: supplierId?.trim(),
        interventionId: interventionId?.trim(),
      },
      access,
    );
  }
}
