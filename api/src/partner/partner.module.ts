import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAdminService } from './partner-admin.service';
import { PartnerMailService } from './partner-mail.service';
import { PartnerNotificationProcessor } from './partner-notification.processor';
import { PartnerNotificationService } from './partner-notification.service';
import { PartnerNotificationsController } from './partner-notifications.controller';
import { PartnerPendingActionsController } from './partner-pending-actions.controller';

@Module({
  imports: [AuthModule],
  controllers: [PartnerAdminController, PartnerNotificationsController, PartnerPendingActionsController],
  providers: [
    PartnerAdminService,
    PartnerMailService,
    PartnerNotificationService,
    PartnerNotificationProcessor,
  ],
  exports: [PartnerAdminService, PartnerNotificationService, PartnerMailService],
})
export class PartnerModule {}
