import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OpsModule } from '../ops/ops.module';
import { WorkOrderQuotesController } from './work-order-quotes.controller';
import { WorkOrderQuotesService } from './work-order-quotes.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

@Module({
  imports: [AuthModule, AuditModule, OpsModule],
  controllers: [WorkOrdersController, WorkOrderQuotesController],
  providers: [WorkOrdersService, WorkOrderQuotesService],
  exports: [WorkOrdersService, WorkOrderQuotesService],
})
export class WorkOrdersModule {}
