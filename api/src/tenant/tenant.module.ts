import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InterCarsClient } from './intercars-client.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TenantController],
  providers: [TenantService, InterCarsClient],
  exports: [TenantService, InterCarsClient],
})
export class TenantModule {}
