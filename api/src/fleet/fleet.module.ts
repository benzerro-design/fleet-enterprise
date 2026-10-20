import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { DriversModule } from '../drivers/drivers.module';
import { OpsModule } from '../ops/ops.module';
import { DashboardService } from './dashboard.service';
import { CivOcrService } from './civ-ocr.service';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { MaintenancePlanService } from './maintenance-plan.service';
import { VehicleEquipmentService } from './vehicle-equipment.service';
import { VehicleFormBriefService } from './vehicle-form-brief.service';
import { TireDomainService } from './tires/tire-domain.service';
import { TireHubService } from './tires/tire-hub.service';
import { TireHotelService } from './tires/tire-hotel.service';
import { VehicleWheelsService } from './vehicle-wheels.service';

@Module({
  imports: [AuthModule, AuditModule, ClientsModule, DriversModule, OpsModule],
  controllers: [FleetController],
  providers: [
    FleetService,
    MaintenancePlanService,
    VehicleEquipmentService,
    TireDomainService,
    TireHubService,
    TireHotelService,
    VehicleWheelsService,
    DashboardService,
    VehicleFormBriefService,
    CivOcrService,
  ],
  exports: [CivOcrService, TireDomainService, TireHotelService],
})
export class FleetModule {}
