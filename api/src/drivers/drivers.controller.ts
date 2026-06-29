import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DriverStatus, MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { TenantId } from '../fleet/tenant-id.decorator';
import { TripsService } from '../ops/trips.service';
import { parseFuelTypesCsv } from '../ops/fuel-types';
import type {
  CreateAssignmentInput,
  CreateDriverInput,
  PatchDriverInput,
} from './drivers.service';
import { DriversService } from './drivers.service';
import {
  DriverAttachmentsService,
  type CreateDriverDocumentInput,
  type PatchDriverDocumentInput,
} from './driver-attachments.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(
    private readonly drivers: DriversService,
    private readonly trips: TripsService,
    private readonly attachments: DriverAttachmentsService,
  ) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('licenseExpiry') licenseExpiry?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.drivers.listPaged(
      tenantSlug,
      {
        page,
        pageSize,
        q: q?.trim(),
        clientId: clientId?.trim(),
        status: parseDriverStatus(status),
        licenseExpiry: parseLicenseExpiryFilter(licenseExpiry),
      },
      access,
    );
  }

  @Get('license-alerts')
  @Roles(...FLEET_READ_ROLES)
  listLicenseAlerts(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(Math.max(1, parseInt(limitStr ?? '20', 10) || 20), 100);
    return this.drivers.listLicenseAlerts(tenantSlug, limit, access);
  }

  @Get(':id/consumption')
  @Roles(...FLEET_READ_ROLES)
  getConsumption(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fuelTypes') fuelTypesRaw?: string,
  ) {
    const fromTrim = from?.trim();
    const toTrim = to?.trim();
    if (!fromTrim || !toTrim) {
      throw new BadRequestException('from and to are required');
    }
    const fuelTypes = parseFuelTypesCsv(fuelTypesRaw);
    return this.trips.getConsumption(tenantSlug, {
      from: fromTrim,
      to: toTrim,
      driverId: id,
      fuelTypes,
    });
  }

  @Get(':id')
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.drivers.getDetail(tenantSlug, id, access);
  }

  @Get(':id/assignments')
  @Roles(...FLEET_READ_ROLES)
  listAssignments(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.drivers.listAssignments(tenantSlug, id, access);
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateDriverInput,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.create(tenantSlug, body, actorUserId, access);
  }

  @Patch(':id')
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchDriverInput,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.patch(tenantSlug, id, body, actorUserId, access);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...FLEET_WRITE_ROLES)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.drivers.delete(tenantSlug, id, actorUserId, access);
  }

  @Post(':id/assignments')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createAssignment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateAssignmentInput,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.createAssignment(tenantSlug, id, body, actorUserId, access);
  }

  @Patch(':id/assignments/:assignmentId/end')
  @Roles(MembershipRole.tenant_admin)
  endAssignment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.endAssignment(tenantSlug, id, assignmentId, actorUserId);
  }

  @Get(':id/documents')
  @Roles(...FLEET_READ_ROLES)
  listDocuments(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.attachments.listDocuments(tenantSlug, id, access);
  }

  @Post(':id/documents')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  createDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateDriverDocumentInput,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.attachments.createDocument(tenantSlug, id, body, actorUserId, access);
  }

  @Patch(':id/documents/:documentId')
  @Roles(...FLEET_WRITE_ROLES)
  patchDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() body: PatchDriverDocumentInput,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.attachments.patchDocument(tenantSlug, id, documentId, body, actorUserId, access);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(204)
  @Roles(...FLEET_WRITE_ROLES)
  async deleteDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentAccess() access: AccessContext,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.attachments.deleteDocument(tenantSlug, id, documentId, actorUserId, access);
  }
}

function parseDriverStatus(raw: string | undefined): DriverStatus | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'active' || s === 'inactive' || s === 'suspended') return s;
  throw new BadRequestException('status must be active, inactive, or suspended');
}

function parseLicenseExpiryFilter(raw: string | undefined): 'expiring' | 'expired' | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'expiring' || s === 'expired') return s;
  throw new BadRequestException('licenseExpiry must be expiring or expired');
}
