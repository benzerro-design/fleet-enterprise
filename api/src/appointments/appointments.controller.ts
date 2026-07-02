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
import { ServiceAppointmentStatus } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
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
  @Roles(...FLEET_READ_ROLES)
  calendar(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
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
    return this.appointments.listCalendar(
      tenantSlug,
      {
        from: from.trim(),
        to: to.trim(),
        supplierIds: parseSupplierIds(supplierIds),
        vehicleId: vehicleId?.trim(),
        clientId: clientId?.trim(),
        status: parseStatus(status),
      },
      access,
    );
  }

  @Get('stats')
  @Roles(...FLEET_READ_ROLES)
  stats(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('clientId') clientId?: string,
  ) {
    return this.appointments.getStats(tenantSlug, clientId?.trim(), access);
  }

  @Get(':id')
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.appointments.getById(tenantSlug, id, access);
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateCalendarAppointmentInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.appointments.create(tenantSlug, body, actorUserId, access);
  }

  @Patch(':id')
  @Roles(...FLEET_WRITE_ROLES)
  update(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: UpdateCalendarAppointmentInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.appointments.update(tenantSlug, id, body, actorUserId, access);
  }
}
