import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { WorkOrdersModule } from '../../work-orders/work-orders.module';
import { ServiceImportController } from './service-import.controller';

@Module({
  imports: [AuthModule, WorkOrdersModule],
  controllers: [ServiceImportController],
})
export class ServiceImportModule {}
