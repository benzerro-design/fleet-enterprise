import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { IamModule } from '../iam/iam.module';
import { PartnerModule } from '../partner/partner.module';
import { CrmTicketsController } from './crm-tickets.controller';
import { CrmTicketsService } from './crm-tickets.service';

@Module({
  imports: [AuthModule, AuditModule, IamModule, PartnerModule],
  controllers: [CrmTicketsController],
  providers: [CrmTicketsService],
  exports: [CrmTicketsService],
})
export class CrmModule {}
