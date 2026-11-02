import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RoadsideController } from './roadside.controller';
import { RoadsideService } from './roadside.service';
import { RsaBrokerController } from './rsa-broker.controller';
import { RsaBrokerService } from './rsa-broker.service';
import { RsaMissionService } from './rsa-mission.service';
import { RsaService } from './rsa.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [RoadsideController, RsaBrokerController],
  providers: [RoadsideService, RsaService, RsaMissionService, RsaBrokerService],
  exports: [RoadsideService, RsaService, RsaMissionService, RsaBrokerService],
})
export class RoadsideModule {}
