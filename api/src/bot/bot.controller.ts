import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { BotService } from './bot.service';
import type { BotDivision, BotMode, BotModuleOperations } from './bot.types';

type StartSessionBody = {
  scenarioId?: string;
  division: BotDivision;
  seed?: number;
  mode?: BotMode;
  concurrentUsers?: number;
  modules: Record<string, BotModuleOperations>;
  faults?: string[];
};

@Controller('bot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(MembershipRole.tenant_admin)
export class BotController {
  constructor(private readonly bot: BotService) {}

  @Get('modules')
  getModules() {
    return this.bot.getModules();
  }

  @Get('sessions')
  listSessions(
    @TenantId() tenantSlug: string,
    @CurrentUserId() userId: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(50, parseInt(limitStr ?? '20', 10) || 20);
    return this.bot.listSessions(tenantSlug, userId, limit);
  }

  @Get('sessions/:id')
  getSession(
    @TenantId() tenantSlug: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.bot.getSession(tenantSlug, userId, id);
  }

  @Post('sessions')
  startSession(
    @TenantId() tenantSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: StartSessionBody,
  ) {
    return this.bot.startSession(tenantSlug, userId, body);
  }
}
