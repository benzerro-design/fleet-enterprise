import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { ClientsModule } from './clients/clients.module';
import { CrmModule } from './crm/crm.module';
import { DriversModule } from './drivers/drivers.module';
import { FleetModule } from './fleet/fleet.module';
import { IamModule } from './iam/iam.module';
import { OpsModule } from './ops/ops.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServiceCasesModule } from './service-cases/service-cases.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [PrismaModule, AuthModule, IamModule, BotModule, ClientsModule, CrmModule, DriversModule, FleetModule, OpsModule, ServiceCasesModule, SuppliersModule, TenantModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
