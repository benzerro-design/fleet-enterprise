import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InterCarsClient } from './intercars-client.service';
import { ProceduresController, QuoteApprovalSettingsController } from './procedures.controller';
import { ProceduresService } from './procedures.service';
import { QuoteApprovalSettingsService } from './quote-approval-settings.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TenantController, ProceduresController, QuoteApprovalSettingsController],
  providers: [TenantService, InterCarsClient, ProceduresService, QuoteApprovalSettingsService],
  exports: [TenantService, InterCarsClient],
})
export class TenantModule {}
