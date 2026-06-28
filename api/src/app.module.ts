import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { CrmModule } from './crm/crm.module';
import { DriversModule } from './drivers/drivers.module';
import { FleetModule } from './fleet/fleet.module';
import { IamModule } from './iam/iam.module';
import { OpsModule } from './ops/ops.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [PrismaModule, AuthModule, IamModule, ClientsModule, CrmModule, DriversModule, FleetModule, OpsModule, TenantModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
