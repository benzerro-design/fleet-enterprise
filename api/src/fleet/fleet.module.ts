import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OpsModule } from '../ops/ops.module';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { MaintenancePlanService } from './maintenance-plan.service';

@Module({
  imports: [AuthModule, AuditModule, OpsModule],
  controllers: [FleetController],
  providers: [FleetService, MaintenancePlanService],
})
export class FleetModule {}
