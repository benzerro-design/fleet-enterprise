import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import {
  WorkOrderQuotesService,
  type UpsertQuoteInput,
} from './work-order-quotes.service';

@Controller('work-orders/:workOrderId/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrderQuotesController {
  constructor(private readonly quotes: WorkOrderQuotesService) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer, MembershipRole.client_user)
  list(@TenantId() tenantSlug: string, @Param('workOrderId') workOrderId: string) {
    return this.quotes.listByWorkOrder(tenantSlug, workOrderId);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Body() body: UpsertQuoteInput,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.createDraft(tenantSlug, workOrderId, body, actorUserId);
  }

  @Patch(':quoteId')
  @Roles(MembershipRole.tenant_admin)
  update(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: UpsertQuoteInput,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.updateDraft(tenantSlug, workOrderId, quoteId, body, actorUserId);
  }

  @Post(':quoteId/submit')
  @Roles(MembershipRole.tenant_admin)
  submit(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.submit(tenantSlug, workOrderId, quoteId, actorUserId);
  }

  @Post(':quoteId/approve')
  @Roles(MembershipRole.tenant_admin)
  approve(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.approve(tenantSlug, workOrderId, quoteId, actorUserId);
  }

  @Post(':quoteId/reject')
  @Roles(MembershipRole.tenant_admin)
  reject(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { reason?: string | null },
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.reject(tenantSlug, workOrderId, quoteId, body?.reason, actorUserId);
  }

  @Post(':quoteId/post-cost')
  @Roles(MembershipRole.tenant_admin)
  postCost(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.postCost(tenantSlug, workOrderId, quoteId, actorUserId);
  }

  @Post(':quoteId/record-invoice')
  @Roles(MembershipRole.tenant_admin)
  recordInvoice(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { invoiceNumber: string; invoiceDate: string; invoiceAttachmentUrl?: string | null },
    @CurrentUserId() actorUserId: string,
  ) {
    return this.quotes.recordInvoice(tenantSlug, workOrderId, quoteId, body, actorUserId);
  }
}
