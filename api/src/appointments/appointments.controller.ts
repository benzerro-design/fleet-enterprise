import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole, ServiceAppointmentStatus } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { AppointmentsService } from './appointments.service';
import type {
  CreateCalendarAppointmentInput,
  UpdateCalendarAppointmentInput,
} from './appointments.types';

function parseStatus(raw?: string): ServiceAppointmentStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as ServiceAppointmentStatus;
  if (
    v === 'scheduled' ||
    v === 'confirmed' ||
    v === 'completed' ||
    v === 'cancelled' ||
    v === 'no_show'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid status');
}

function parseSupplierIds(raw?: string): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('calendar')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  calendar(
    @TenantId() tenantSlug: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('supplierIds') supplierIds?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
  ) {
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException('from and to are required');
    }
    return this.appointments.listCalendar(tenantSlug, {
      from: from.trim(),
      to: to.trim(),
      supplierIds: parseSupplierIds(supplierIds),
      vehicleId: vehicleId?.trim(),
      clientId: clientId?.trim(),
      status: parseStatus(status),
    });
  }

  @Get('stats')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  stats(@TenantId() tenantSlug: string, @Query('clientId') clientId?: string) {
    return this.appointments.getStats(tenantSlug, clientId?.trim());
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.appointments.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateCalendarAppointmentInput,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.appointments.create(tenantSlug, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  update(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: UpdateCalendarAppointmentInput,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.appointments.update(tenantSlug, id, body, actorUserId);
  }
}
