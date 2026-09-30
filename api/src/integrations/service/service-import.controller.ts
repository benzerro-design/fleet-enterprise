import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CurrentAccess } from '../../iam/current-access.decorator';
import type { AccessContext } from '../../iam/access-context.types';
import { FLEET_WRITE_ROLES } from '../../iam/role-sets';
import { TenantId } from '../../fleet/tenant-id.decorator';
import {
  type ServiceQuoteImportInput,
  WorkOrderQuotesService,
} from '../../work-orders/work-order-quotes.service';

function parseBody(body: unknown): ServiceQuoteImportInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Invalid body');
  }
  const o = body as Record<string, unknown>;
  const workOrderId = typeof o.workOrderId === 'string' ? o.workOrderId.trim() : '';
  const externalQuoteId = typeof o.externalQuoteId === 'string' ? o.externalQuoteId.trim() : '';
  if (!workOrderId || !externalQuoteId) {
    throw new BadRequestException('workOrderId and externalQuoteId are required');
  }
  return {
    workOrderId,
    externalQuoteId,
    sourcePdfUrl: typeof o.sourcePdfUrl === 'string' ? o.sourcePdfUrl : null,
    lines: Array.isArray(o.lines) ? (o.lines as ServiceQuoteImportInput['lines']) : undefined,
    invoiceNumber: typeof o.invoiceNumber === 'string' ? o.invoiceNumber : null,
    invoiceGrossCents:
      o.invoiceGrossCents != null && Number.isFinite(Number(o.invoiceGrossCents))
        ? Math.round(Number(o.invoiceGrossCents))
        : null,
  };
}

@Controller('integrations/service')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceImportController {
  constructor(private readonly quotes: WorkOrderQuotesService) {}

  @Post('quotes')
  @Roles(...FLEET_WRITE_ROLES)
  @HttpCode(201)
  importQuote(
    @TenantId() tenantSlug: string,
    @Body() body: unknown,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.quotes.importServiceExternalQuote(tenantSlug, parseBody(body), actorUserId, access);
  }
}
