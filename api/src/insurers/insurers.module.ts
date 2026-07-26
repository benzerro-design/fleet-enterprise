import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InsurersController } from './insurers.controller';
import { InsurersService } from './insurers.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InsurersController],
  providers: [InsurersService],
  exports: [InsurersService],
})
export class InsurersModule {}
