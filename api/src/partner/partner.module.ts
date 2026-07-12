import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAdminService } from './partner-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [PartnerAdminController],
  providers: [PartnerAdminService],
  exports: [PartnerAdminService],
})
export class PartnerModule {}
