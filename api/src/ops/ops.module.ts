import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CostsController } from './costs.controller';
import { CostsService } from './costs.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { TripSheetsController } from './trip-sheets.controller';
import { TripSheetsService } from './trip-sheets.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripSheetPdfStorageService } from '../storage/trip-sheet-pdf-storage.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    TripSheetsController,
    TripsController,
    MaintenanceController,
    CostsController,
    DocumentsController,
    RemindersController,
  ],
  providers: [
    TripsService,
    TripSheetsService,
    TripSheetPdfStorageService,
    MaintenanceService,
    CostsService,
    DocumentsService,
    RemindersService,
  ],
  exports: [RemindersService],
})
export class OpsModule {}
