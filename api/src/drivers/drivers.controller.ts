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
import { TenantId } from '../fleet/tenant-id.decorator';
import type {
  CreateAssignmentInput,
  CreateDriverInput,
  PatchDriverInput,
} from './drivers.service';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.drivers.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      clientId: clientId?.trim(),
      status: parseDriverStatus(status),
    });
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.drivers.getDetail(tenantSlug, id);
  }

  @Get(':id/assignments')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listAssignments(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.drivers.listAssignments(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateDriverInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.create(tenantSlug, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchDriverInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.patch(tenantSlug, id, body, actorUserId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.drivers.delete(tenantSlug, id, actorUserId);
  }

  @Post(':id/assignments')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  createAssignment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateAssignmentInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.drivers.createAssignment(tenantSlug, id, body, actorUserId);
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
}

function parseDriverStatus(raw: string | undefined): DriverStatus | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'active' || s === 'inactive' || s === 'suspended') return s;
  throw new BadRequestException('status must be active, inactive, or suspended');
}
