import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAdminService } from './partner-admin.service';
import { PartnerNotificationService } from './partner-notification.service';

@Module({
  imports: [AuthModule],
  controllers: [PartnerAdminController],
  providers: [PartnerAdminService, PartnerNotificationService],
  exports: [PartnerAdminService, PartnerNotificationService],
})
export class PartnerModule {}
