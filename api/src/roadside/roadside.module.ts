import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RoadsideController } from './roadside.controller';
import { RoadsideService } from './roadside.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [RoadsideController],
  providers: [RoadsideService],
  exports: [RoadsideService],
})
export class RoadsideModule {}
