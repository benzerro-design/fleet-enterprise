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
import { MembershipRole, MobilityAssignmentStatus, MobilityDeliveryMode } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { FLEET_READ_ROLES } from '../iam/role-sets';
import type {
  CreateMobilityAssignmentInput,
  PatchMobilityAssignmentInput,
} from './mobility.service';
import { MobilityService } from './mobility.service';

function parseStatus(raw?: string): MobilityAssignmentStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as MobilityAssignmentStatus;
  if (
    v === 'draft' ||
    v === 'eligible' ||
    v === 'reserved' ||
    v === 'active' ||
    v === 'returned' ||
    v === 'waived' ||
    v === 'cancelled'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid status');
}

function parseDeliveryMode(raw?: string): MobilityDeliveryMode | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as MobilityDeliveryMode;
  if (v === 'customer_pickup' || v === 'delivered_to_customer' || v === 'at_supplier') {
    return v;
  }
  throw new BadRequestException('Invalid deliveryMode');
}

@Controller('mobility')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MobilityController {
  constructor(private readonly mobility: MobilityService) {}

  @Get('assignments')
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('workOrderId') workOrderId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.mobility.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseStatus(status),
      workOrderId: workOrderId?.trim(),
    });
  }

  @Get('eligibility/:workOrderId')
  @Roles(...FLEET_READ_ROLES)
  eligibility(@TenantId() tenantSlug: string, @Param('workOrderId') workOrderId: string) {
    return this.mobility.getEligibility(tenantSlug, workOrderId);
  }

  @Get('assignments/:id')
  @Roles(...FLEET_READ_ROLES)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.mobility.getById(tenantSlug, id);
  }

  @Post('assignments')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateMobilityAssignmentInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.mobility.create(tenantSlug, body, actorUserId);
  }

  @Patch('assignments/:id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchMobilityAssignmentInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    if (body.deliveryMode !== undefined && body.deliveryMode !== null) {
      parseDeliveryMode(body.deliveryMode);
    }
    return this.mobility.patch(tenantSlug, id, body, actorUserId);
  }
}
