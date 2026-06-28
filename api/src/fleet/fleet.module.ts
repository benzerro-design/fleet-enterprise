import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { DriversModule } from '../drivers/drivers.module';
import { OpsModule } from '../ops/ops.module';
import { DashboardService } from './dashboard.service';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { MaintenancePlanService } from './maintenance-plan.service';
import { VehicleFormBriefService } from './vehicle-form-brief.service';

@Module({
  imports: [AuthModule, AuditModule, ClientsModule, DriversModule, OpsModule],
  controllers: [FleetController],
  providers: [FleetService, MaintenancePlanService, DashboardService, VehicleFormBriefService],
})
export class FleetModule {}
