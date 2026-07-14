import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAdminService } from './partner-admin.service';
import { PartnerMailService } from './partner-mail.service';
import { PartnerNotificationProcessor } from './partner-notification.processor';
import { PartnerNotificationService } from './partner-notification.service';

@Module({
  imports: [AuthModule],
  controllers: [PartnerAdminController],
  providers: [
    PartnerAdminService,
    PartnerMailService,
    PartnerNotificationService,
    PartnerNotificationProcessor,
  ],
  exports: [PartnerAdminService, PartnerNotificationService],
})
export class PartnerModule {}
