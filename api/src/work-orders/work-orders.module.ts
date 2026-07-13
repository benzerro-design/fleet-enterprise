import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PartnerModule } from '../partner/partner.module';
import { OpsModule } from '../ops/ops.module';
import { WorkOrderMessagesController } from './work-order-messages.controller';
import { WorkOrderMessagesService } from './work-order-messages.service';
import { WorkOrderQuotesController } from './work-order-quotes.controller';
import { WorkOrderQuotesService } from './work-order-quotes.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

@Module({
  imports: [AuthModule, AuditModule, OpsModule, PartnerModule],
  controllers: [WorkOrdersController, WorkOrderQuotesController, WorkOrderMessagesController],
  providers: [WorkOrdersService, WorkOrderQuotesService, WorkOrderMessagesService],
  exports: [WorkOrdersService, WorkOrderQuotesService, WorkOrderMessagesService],
})
export class WorkOrdersModule {}
