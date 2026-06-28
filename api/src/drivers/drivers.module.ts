import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OpsModule } from '../ops/ops.module';
import { DriverAttachmentsService } from './driver-attachments.service';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [AuthModule, AuditModule, OpsModule],
  controllers: [DriversController],
  providers: [DriversService, DriverAttachmentsService],
  exports: [DriversService],
})
export class DriversModule {}
