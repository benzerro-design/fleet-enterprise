import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientAttachmentsService } from './client-attachments.service';
import { ClientSubscriptionsService } from './client-subscriptions.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientAttachmentsService, ClientSubscriptionsService],
  exports: [ClientsService],
})
export class ClientsModule {}
