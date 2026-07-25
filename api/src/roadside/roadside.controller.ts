import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  RoadsideInterventionKind,
  RoadsideInterventionStatus,
} from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import type {
  CreateRoadsideInterventionInput,
  PatchRoadsideInterventionInput,
} from './roadside.service';
import { RoadsideService } from './roadside.service';

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

@Controller('roadside')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoadsideController {
  constructor(private readonly roadside: RoadsideService) {}

  @Get('interventions')
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
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
    return this.roadside.listPaged(tenantSlug, {
      page,
      pageSize,
      serviceCaseId: serviceCaseId?.trim(),
      ticketId: ticketId?.trim(),
      workOrderId: workOrderId?.trim(),
      status: parseStatus(status),
      kind: parseKind(kind),
    });
  }

  @Get('interventions/:id')
  @Roles(...FLEET_READ_ROLES)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.roadside.getById(tenantSlug, id);
  }

  @Post('interventions')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateRoadsideInterventionInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (body.kind) parseKind(body.kind);
    if (body.status) parseStatus(body.status);
    return this.roadside.create(tenantSlug, body, actorUserId);
  }

  @Patch('interventions/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchRoadsideInterventionInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (body.kind) parseKind(body.kind);
    if (body.status) parseStatus(body.status);
    return this.roadside.patch(tenantSlug, id, body, actorUserId);
  }
}
