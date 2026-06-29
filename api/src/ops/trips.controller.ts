import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole, TripPurpose, TripRoadType } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { TenantId } from '../fleet/tenant-id.decorator';
import type { CreateTripInput, PatchTripInput, TripBrowseFilters } from './trips.service';
import { TripsService } from './trips.service';
import { parseFuelTypesCsv } from './fuel-types';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get('export')
  @Roles(...FLEET_READ_ROLES)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="trips.csv"')
  async exportTrips(@TenantId() tenantSlug: string, @Query() q: Record<string, string | undefined>) {
    const csv = await this.trips.exportCsv(tenantSlug, parseTripBrowseQuery(q));
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get()
  @Roles(...FLEET_READ_ROLES)
  listTrips(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query() q: Record<string, string | undefined>,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.trips.list(
      tenantSlug,
      {
        page,
        pageSize,
        ...parseTripBrowseQuery(q),
      },
      access,
    );
  }

  @Get('consumption')
  @Roles(...FLEET_READ_ROLES)
  getConsumption(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query() q: Record<string, string | undefined>,
  ) {
    const from = q['from']?.trim();
    const to = q['to']?.trim();
    if (!from || !to) {
      throw new BadRequestException('from and to are required');
    }
    const vehicleIdsRaw = q['vehicleIds']?.trim();
    const vehicleIds = vehicleIdsRaw
      ? vehicleIdsRaw.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;
    const fuelTypes = parseFuelTypesCsv(q['fuelTypes']);
    const driverId = q['driverId']?.trim();
    return this.trips.getConsumption(tenantSlug, { from, to, vehicleIds, fuelTypes, driverId }, access);
  }

  @Get(':tripId')
  @Roles(...FLEET_READ_ROLES)
  getTrip(@TenantId() tenantSlug: string, @Param('tripId') tripId: string) {
    return this.trips.getById(tenantSlug, tripId);
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createTrip(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertCreateTripDto(body);
    return this.trips.create(tenantSlug, dto, actorUserId, access);
  }

  @Patch(':tripId')
  @Roles(...FLEET_WRITE_ROLES)
  patchTrip(
    @TenantId() tenantSlug: string,
    @Param('tripId') tripId: string,
    @Body() body: unknown,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    const dto = assertPatchTripDto(body);
    return this.trips.patch(tenantSlug, tripId, dto, actorUserId, access);
  }

  @Delete(':tripId')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(204)
  async deleteTrip(
    @TenantId() tenantSlug: string,
    @Param('tripId') tripId: string,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.trips.delete(tenantSlug, tripId, actorUserId, access);
  }
}

function parseTripBrowseQuery(q: Record<string, string | undefined>): TripBrowseFilters {
  const registrationNumber = q['registrationNumber']?.trim();
  const clientId = q['clientId']?.trim();
  const searchQ = q['q']?.trim();
  const startedFrom = q['startedFrom']?.trim();
  const startedTo = q['startedTo']?.trim();
  const endedRaw = q['ended']?.trim();
  const driverId = q['driverId']?.trim();
  let ended: TripBrowseFilters['ended'];
  if (endedRaw === 'open' || endedRaw === 'closed') {
    ended = endedRaw;
  }
  return {
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(clientId ? { clientId } : {}),
    ...(driverId ? { driverId } : {}),
    ...(searchQ ? { q: searchQ } : {}),
    ...(startedFrom ? { startedFrom } : {}),
    ...(startedTo ? { startedTo } : {}),
    ...(ended ? { ended } : {}),
  };
}

function assertCreateTripDto(body: unknown): CreateTripInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');
  const vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  return {
    vehicleId,
    reference: optionalString(body.reference),
    startedAt: optionalIsoDateString(body.startedAt),
    endedAt:
      'endedAt' in body
        ? body.endedAt === null
          ? null
          : optionalIsoDateString(body.endedAt)
        : undefined,
    originLabel: optionalNullableString(body.originLabel),
    destLabel: optionalNullableString(body.destLabel),
    distanceKm: optionalNonNegativeInt(body.distanceKm, 'distanceKm'),
    purpose: optionalTripPurpose(body.purpose),
    roadType: optionalTripRoadType(body.roadType),
    odometerStartKm: optionalNonNegativeInt(body.odometerStartKm, 'odometerStartKm') ?? null,
    odometerEndKm: optionalNonNegativeInt(body.odometerEndKm, 'odometerEndKm') ?? null,
    driverId: optionalNullableCuid(body.driverId, 'driverId'),
    driverName: optionalNullableString(body.driverName),
  };
}

function assertPatchTripDto(body: unknown): PatchTripInput {
  if (!isRecord(body)) throw new BadRequestException('Invalid JSON body');

  const dto: PatchTripInput = {};

  if ('vehicleId' in body) dto.vehicleId = asNonEmptyString(body.vehicleId, 'vehicleId');
  if ('reference' in body) {
    dto.reference = body.reference === null ? null : optionalString(body.reference) ?? null;
  }
  if ('startedAt' in body) {
    dto.startedAt = optionalIsoDateString(body.startedAt);
    if (dto.startedAt === undefined) {
      throw new BadRequestException('Field "startedAt" must be a valid ISO date string');
    }
  }
  if ('endedAt' in body) {
    dto.endedAt =
      body.endedAt === null ? null : optionalIsoDateString(body.endedAt) ?? undefined;
    if (body.endedAt !== null && dto.endedAt === undefined) {
      throw new BadRequestException('Field "endedAt" must be a valid ISO date string or null');
    }
  }
  if ('originLabel' in body) dto.originLabel = optionalNullableString(body.originLabel);
  if ('destLabel' in body) dto.destLabel = optionalNullableString(body.destLabel);
  if ('distanceKm' in body) {
    if (body.distanceKm === null) dto.distanceKm = null;
    else dto.distanceKm = optionalNonNegativeInt(body.distanceKm, 'distanceKm') ?? undefined;
  }
  if ('purpose' in body) dto.purpose = optionalTripPurpose(body.purpose);
  if ('roadType' in body) dto.roadType = optionalTripRoadType(body.roadType);
  if ('odometerStartKm' in body) {
    if (body.odometerStartKm === null) dto.odometerStartKm = null;
    else {
      dto.odometerStartKm =
        optionalNonNegativeInt(body.odometerStartKm, 'odometerStartKm') ?? null;
    }
  }
  if ('odometerEndKm' in body) {
    if (body.odometerEndKm === null) dto.odometerEndKm = null;
    else {
      dto.odometerEndKm = optionalNonNegativeInt(body.odometerEndKm, 'odometerEndKm') ?? null;
    }
  }
  if ('driverId' in body) dto.driverId = optionalNullableCuid(body.driverId, 'driverId');
  if ('driverName' in body) dto.driverName = optionalNullableString(body.driverName);

  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('No fields to update');
  }

  return dto;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNonEmptyString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new BadRequestException(`Field "${field}" must be a non-empty string`);
  }
  return v.trim();
}

function optionalString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== 'string') {
    throw new BadRequestException('Expected string or null');
  }
  const s = v.trim();
  return s.length === 0 ? undefined : s;
}

function optionalNullableString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') {
    throw new BadRequestException('Expected string or null');
  }
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function optionalIsoDateString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new BadRequestException('Expected ISO date string or null');
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return d.toISOString();
}

function optionalNonNegativeInt(v: unknown, field: string): number | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new BadRequestException(`Field "${field}" must be a non-negative integer`);
  }
  return v;
}

const TRIP_PURPOSES: TripPurpose[] = ['business', 'personal', 'mixed'];
const TRIP_ROAD_TYPES: TripRoadType[] = ['urban', 'extra_urban', 'highway', 'mixed'];

function optionalNullableCuid(v: unknown, field: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') {
    throw new BadRequestException(`Field "${field}" must be a string or null`);
  }
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function optionalTripPurpose(v: unknown): TripPurpose | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string' || !TRIP_PURPOSES.includes(v as TripPurpose)) {
    throw new BadRequestException(`purpose must be one of: ${TRIP_PURPOSES.join(', ')}`);
  }
  return v as TripPurpose;
}

function optionalTripRoadType(v: unknown): TripRoadType | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string' || !TRIP_ROAD_TYPES.includes(v as TripRoadType)) {
    throw new BadRequestException(`roadType must be one of: ${TRIP_ROAD_TYPES.join(', ')}`);
  }
  return v as TripRoadType;
}
