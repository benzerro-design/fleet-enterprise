import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { TenantId } from '../fleet/tenant-id.decorator';
import type {
  AdvanceServiceCaseInput,
  CreateServiceAppointmentInput,
  PatchDamageClaimInput,
  PostApprovalInput,
  UpdateServiceAppointmentInput,
} from './service-cases.service';
import { ServiceCasesService } from './service-cases.service';

@Controller('service-cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceCasesController {
  constructor(private readonly serviceCases: ServiceCasesService) {}

  @Get('by-ticket/:ticketId')
  @Roles(...FLEET_READ_ROLES)
  async getByTicket(
    @TenantId() tenantSlug: string,
    @Param('ticketId') ticketId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    const row = await this.serviceCases.getByTicketId(tenantSlug, ticketId, access);
    if (!row) throw new NotFoundException('Service case not found for ticket');
    return row;
  }

  @Post('from-ticket/:ticketId')
  @Roles(...FLEET_WRITE_ROLES)
  startFromTicket(
    @TenantId() tenantSlug: string,
    @Param('ticketId') ticketId: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.startFromTicket(tenantSlug, ticketId, actorUserId, access);
  }

  @Post(':id/advance')
  @Roles(...FLEET_WRITE_ROLES)
  advance(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: AdvanceServiceCaseInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.advance(tenantSlug, id, body, actorUserId, access);
  }

  @Patch(':id/damage-claim')
  @Roles(...FLEET_WRITE_ROLES)
  patchDamageClaim(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchDamageClaimInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.patchDamageClaim(tenantSlug, id, body, actorUserId, access);
  }

  @Post(':id/post-approval')
  @Roles(...FLEET_WRITE_ROLES)
  postApproval(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PostApprovalInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.applyPostApproval(tenantSlug, id, body, actorUserId, access);
  }

  @Post(':id/appointments')
  @Roles(...FLEET_WRITE_ROLES)
  createAppointment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateServiceAppointmentInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.createAppointment(tenantSlug, id, body, actorUserId, access);
  }

  @Post('appointments/:appointmentId/supplier-validate')
  @Roles(...FLEET_WRITE_ROLES)
  supplierValidateAppointment(
    @TenantId() tenantSlug: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: { scheduledAt?: string; durationMin?: number; notes?: string | null },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.supplierValidateAppointment(
      tenantSlug,
      appointmentId,
      body,
      actorUserId,
      access,
    );
  }

  @Post('appointments/:appointmentId/request-cancel')
  @Roles(...FLEET_WRITE_ROLES)
  requestCancelAppointment(
    @TenantId() tenantSlug: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: { note?: string | null },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.requestCancelAppointment(
      tenantSlug,
      appointmentId,
      body,
      actorUserId,
      access,
    );
  }

  @Post('appointments/:appointmentId/confirm')
  @Roles(...FLEET_WRITE_ROLES)
  confirmAppointment(
    @TenantId() tenantSlug: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.confirmAppointment(tenantSlug, appointmentId, actorUserId, access);
  }

  @Post('appointments/:appointmentId/acknowledge')
  @Roles(...FLEET_WRITE_ROLES)
  acknowledgeAppointment(
    @TenantId() tenantSlug: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.acknowledgeAppointment(tenantSlug, appointmentId, actorUserId, access);
  }

  @Patch('appointments/:appointmentId')
  @Roles(...FLEET_WRITE_ROLES)
  updateAppointment(
    @TenantId() tenantSlug: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: UpdateServiceAppointmentInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.updateAppointment(tenantSlug, appointmentId, body, actorUserId, access);
  }
}
