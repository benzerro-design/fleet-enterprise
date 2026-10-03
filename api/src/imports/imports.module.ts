import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
