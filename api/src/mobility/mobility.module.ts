import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MobilityController } from './mobility.controller';
import { MobilityService } from './mobility.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [MobilityController],
  providers: [MobilityService],
  exports: [MobilityService],
})
export class MobilityModule {}
