import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { IamModule } from '../iam/iam.module';
import { ServiceCasesController } from './service-cases.controller';
import { ServiceCasesService } from './service-cases.service';

@Module({
  imports: [AuthModule, AuditModule, IamModule],
  controllers: [ServiceCasesController],
  providers: [ServiceCasesService],
  exports: [ServiceCasesService],
})
export class ServiceCasesModule {}
