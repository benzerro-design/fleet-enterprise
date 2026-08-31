import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { PartnerInvitesPublicController, SupplierInvitesController } from './supplier-invites.controller';
import { SupplierInvitesService } from './supplier-invites.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [AuthModule, AuditModule, ClientsModule],
  controllers: [SuppliersController, SupplierInvitesController, PartnerInvitesPublicController],
  providers: [SuppliersService, SupplierInvitesService],
  exports: [SuppliersService, SupplierInvitesService],
})
export class SuppliersModule {}
