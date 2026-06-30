import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IamModule } from '../iam/iam.module';
import { OpsModule } from '../ops/ops.module';
import { BotController } from './bot.controller';
import { BotGuardService } from './bot-guard.service';
import { BotService } from './bot.service';

@Module({
  imports: [AuthModule, IamModule, OpsModule],
  controllers: [BotController],
  providers: [BotService, BotGuardService],
})
export class BotModule {}
