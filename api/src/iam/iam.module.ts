import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccessContextService } from './access-context.service';
import { AccessScopeInterceptor } from './access-scope.interceptor';
import { ClientMembershipsController } from './client-memberships.controller';
import { ClientMembershipsService } from './client-memberships.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ClientMembershipsController],
  providers: [
    AccessContextService,
    ClientMembershipsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AccessScopeInterceptor,
    },
  ],
  exports: [AccessContextService, ClientMembershipsService],
})
export class IamModule {}
