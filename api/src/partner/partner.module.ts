import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAdminService } from './partner-admin.service';
import { PartnerMailService } from './partner-mail.service';
import { PartnerNotificationProcessor } from './partner-notification.processor';
import { PartnerNotificationService } from './partner-notification.service';
import { PartnerNotificationsController } from './partner-notifications.controller';
import { PartnerPendingActionsController } from './partner-pending-actions.controller';
import { PartnerReportsController } from './partner-reports.controller';
import { PartnerReportsService } from './partner-reports.service';
import { PartnerScorecardController } from './partner-scorecard.controller';
import { PartnerScorecardService } from './partner-scorecard.service';
import { PartnerTireHotelController } from './partner-tire-hotel.controller';
import { PartnerTireHotelService } from './partner-tire-hotel.service';

@Module({
  imports: [AuthModule, FleetModule],
  controllers: [
    PartnerAdminController,
    PartnerNotificationsController,
    PartnerPendingActionsController,
    PartnerScorecardController,
    PartnerReportsController,
    PartnerTireHotelController,
  ],
  providers: [
    PartnerAdminService,
    PartnerMailService,
    PartnerNotificationService,
    PartnerNotificationProcessor,
    PartnerScorecardService,
    PartnerReportsService,
    PartnerTireHotelService,
  ],
  exports: [PartnerAdminService, PartnerNotificationService, PartnerMailService],
})
export class PartnerModule {}
