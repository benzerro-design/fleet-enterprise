import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "iamSettings" JSONB`);
    } catch {
      /* ignore — local/sqlite or missing privilege; migrate deploy is the source of truth */
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
