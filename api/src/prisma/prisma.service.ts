import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "iamSettings" JSONB`);
      await this.$executeRawUnsafe(
        `ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "requireDriverAckOverride" BOOLEAN`,
      );
      await this.$executeRawUnsafe(
        `ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "fleetCounterProposedBy" TEXT`,
      );
      await this.$executeRawUnsafe(
        `ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "vehicleDocumentId" TEXT`,
      );
    } catch {
      /* ignore — local/sqlite or missing privilege; migrate deploy is the source of truth */
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
