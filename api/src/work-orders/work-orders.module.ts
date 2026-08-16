import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { PartnerModule } from '../partner/partner.module';
import { OpsModule } from '../ops/ops.module';
import { TenantModule } from '../tenant/tenant.module';
import { WorkOrderMessagesController } from './work-order-messages.controller';
import { WorkOrderMessagesService } from './work-order-messages.service';
import { WorkOrderQuotesController } from './work-order-quotes.controller';
import { WorkOrderQuotesService } from './work-order-quotes.service';
import { WorkOrderWarrantyController } from './work-order-warranty.controller';
import { WorkOrderWarrantyService } from './work-order-warranty.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

@Module({
  imports: [AuthModule, AuditModule, OpsModule, PartnerModule, FleetModule, TenantModule],
  controllers: [
    WorkOrdersController,
    WorkOrderQuotesController,
    WorkOrderWarrantyController,
    WorkOrderMessagesController,
  ],
  providers: [
    WorkOrdersService,
    WorkOrderQuotesService,
    WorkOrderWarrantyService,
    WorkOrderMessagesService,
  ],
  exports: [
    WorkOrdersService,
    WorkOrderQuotesService,
    WorkOrderWarrantyService,
    WorkOrderMessagesService,
  ],
})
export class WorkOrdersModule {}
