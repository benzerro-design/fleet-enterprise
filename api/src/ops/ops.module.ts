import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TripsController, MaintenanceController, CostsController, DocumentsController],
  providers: [TripsService, MaintenanceService, CostsService, DocumentsService],
})
export class OpsModule {}
