import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { RsaBrokerService } from './rsa-broker.service';

/**
 * RSA-S5 — webhook inbound fără JWT.
 * Auth: X-RSA-Broker-Secret (+ X-Tenant-Slug / X-Supplier-Id sau query).
 */
@Controller('roadside/broker')
export class RsaBrokerController {
  constructor(private readonly broker: RsaBrokerService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-rsa-broker-secret') secretHeader?: string,
    @Headers('x-tenant-slug') tenantHeader?: string,
    @Headers('x-supplier-id') supplierHeader?: string,
    @Query('tenant') tenantQuery?: string,
    @Query('supplierId') supplierQuery?: string,
    @Body()
    body?: {
      eventType?: string;
      interventionId?: string;
      displayNumber?: string;
      externalRef?: string;
      etaMinutes?: number;
      notes?: string;
      missionStatus?: string;
      tenantSlug?: string;
      supplierId?: string;
      secret?: string;
    },
  ) {
    const secret = (secretHeader ?? body?.secret ?? '').trim();
    const tenantSlug = (tenantHeader ?? tenantQuery ?? body?.tenantSlug ?? '').trim();
    const supplierId = (supplierHeader ?? supplierQuery ?? body?.supplierId ?? '').trim();
    if (!secret) throw new UnauthorizedException('Missing X-RSA-Broker-Secret');
    if (!tenantSlug) throw new UnauthorizedException('Missing tenant slug');
    if (!supplierId) throw new UnauthorizedException('Missing supplierId');

    return this.broker.handleInboundWebhook({
      tenantSlug,
      supplierId,
      secret,
      body: body ?? {},
    });
  }

  @Post('webhook/:supplierId')
  @HttpCode(200)
  webhookForSupplier(
    @Param('supplierId') supplierId: string,
    @Headers('x-rsa-broker-secret') secretHeader?: string,
    @Headers('x-tenant-slug') tenantHeader?: string,
    @Query('tenant') tenantQuery?: string,
    @Body()
    body?: {
      eventType?: string;
      interventionId?: string;
      displayNumber?: string;
      externalRef?: string;
      etaMinutes?: number;
      notes?: string;
      tenantSlug?: string;
      secret?: string;
    },
  ) {
    const secret = (secretHeader ?? body?.secret ?? '').trim();
    const tenantSlug = (tenantHeader ?? tenantQuery ?? body?.tenantSlug ?? '').trim();
    if (!secret) throw new UnauthorizedException('Missing X-RSA-Broker-Secret');
    if (!tenantSlug) throw new UnauthorizedException('Missing tenant slug');
    return this.broker.handleInboundWebhook({
      tenantSlug,
      supplierId,
      secret,
      body: body ?? {},
    });
  }
}
