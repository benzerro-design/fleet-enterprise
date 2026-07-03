import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { TenantId } from '../fleet/tenant-id.decorator';
import type {
  AdvanceServiceCaseInput,
  CreateServiceAppointmentInput,
  UpdateServiceAppointmentInput,
} from './service-cases.service';
import { ServiceCasesService } from './service-cases.service';

@Controller('service-cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceCasesController {
  constructor(private readonly serviceCases: ServiceCasesService) {}

  @Get('by-ticket/:ticketId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
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
  @Roles(MembershipRole.tenant_admin)
  startFromTicket(
    @TenantId() tenantSlug: string,
    @Param('ticketId') ticketId: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.startFromTicket(tenantSlug, ticketId, actorUserId, access);
  }

  @Post(':id/advance')
  @Roles(MembershipRole.tenant_admin)
  advance(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: AdvanceServiceCaseInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.advance(tenantSlug, id, body, actorUserId, access);
  }

  @Post(':id/appointments')
  @Roles(MembershipRole.tenant_admin)
  createAppointment(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateServiceAppointmentInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.serviceCases.createAppointment(tenantSlug, id, body, actorUserId, access);
  }

  @Patch('appointments/:appointmentId')
  @Roles(MembershipRole.tenant_admin)
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
