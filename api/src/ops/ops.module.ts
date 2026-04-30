import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TripsController, MaintenanceController, CostsController],
  providers: [TripsService, MaintenanceService, CostsService],
})
export class OpsModule {}
