import { Body, Controller, Get, Param, Patch, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { TenantId } from '../fleet/tenant-id.decorator';
import {
  WorkOrderQuotesService,
  type PostCostInput,
  type UpsertQuoteInput,
} from './work-order-quotes.service';

@Controller('work-orders/:workOrderId/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkOrderQuotesController {
  constructor(private readonly quotes: WorkOrderQuotesService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(@TenantId() tenantSlug: string, @Param('workOrderId') workOrderId: string) {
    return this.quotes.listByWorkOrder(tenantSlug, workOrderId);
  }

  @Get(':quoteId/pdf')
  @Roles(...FLEET_READ_ROLES)
  async pdf(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
  ) {
    const { buffer, filename } = await this.quotes.exportPdf(tenantSlug, workOrderId, quoteId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  create(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Body() body: UpsertQuoteInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.createDraft(tenantSlug, workOrderId, body, actorUserId, access);
  }

  @Patch(':quoteId')
  @Roles(...FLEET_WRITE_ROLES)
  update(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: UpsertQuoteInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.updateDraft(tenantSlug, workOrderId, quoteId, body, actorUserId, access);
  }

  @Post(':quoteId/submit')
  @Roles(...FLEET_WRITE_ROLES)
  submit(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.submit(tenantSlug, workOrderId, quoteId, actorUserId, access);
  }

  @Post(':quoteId/approve')
  @Roles(...FLEET_WRITE_ROLES)
  approve(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.approve(tenantSlug, workOrderId, quoteId, actorUserId, access);
  }

  @Post(':quoteId/reject')
  @Roles(...FLEET_WRITE_ROLES)
  reject(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { reason?: string | null },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.reject(tenantSlug, workOrderId, quoteId, body?.reason, actorUserId, access);
  }

  @Post(':quoteId/post-cost')
  @Roles(...FLEET_WRITE_ROLES)
  postCost(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: PostCostInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.postCost(tenantSlug, workOrderId, quoteId, body ?? {}, actorUserId, access);
  }

  @Post(':quoteId/record-invoice')
  @Roles(...FLEET_WRITE_ROLES)
  recordInvoice(
    @TenantId() tenantSlug: string,
    @Param('workOrderId') workOrderId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { invoiceNumber: string; invoiceDate: string; invoiceAttachmentUrl?: string | null },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.recordInvoice(tenantSlug, workOrderId, quoteId, body, actorUserId, access);
  }
}
