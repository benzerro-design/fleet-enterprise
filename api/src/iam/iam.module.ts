import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccessContextService } from './access-context.service';
import { AccessScopeInterceptor } from './access-scope.interceptor';
import { ClientMembershipsController } from './client-memberships.controller';
import { ClientMembershipsService } from './client-memberships.service';
import { SupplierMembershipsController } from './supplier-memberships.controller';
import { SupplierMembershipsService } from './supplier-memberships.service';
import {
  ClientInvitesController,
  TenantInvitesController,
  UserInvitesPublicController,
} from './user-invites.controller';
import { UserInvitesService } from './user-invites.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    ClientMembershipsController,
    SupplierMembershipsController,
    TenantInvitesController,
    ClientInvitesController,
    UserInvitesPublicController,
  ],
  providers: [
    AccessContextService,
    ClientMembershipsService,
    SupplierMembershipsService,
    UserInvitesService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AccessScopeInterceptor,
    },
  ],
  exports: [AccessContextService, ClientMembershipsService, UserInvitesService],
})
export class IamModule {}
