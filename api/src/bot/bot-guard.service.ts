import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { AccessContextService } from '../iam/access-context.service';
import type { AccessContext } from '../iam/access-context.types';
import { PrismaService } from '../prisma/prisma.service';
import { divisionClientCodes } from './bot-scenarios';
import type { BotDivision } from './bot.types';
import { BOT_DEMO_TENANT_SLUG } from './bot.types';

@Injectable()
export class BotGuardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessCtx: AccessContextService,
  ) {}

  isBotEnabled(): boolean {
    const flag = process.env.BOT_ENABLED?.trim();
    if (flag === '0' || flag === 'false') return false;
    return process.env.NODE_ENV !== 'production' || flag === '1' || flag === 'true';
  }

  async assertCanRunBot(tenantSlug: string, userId: string): Promise<AccessContext> {
    if (!this.isBotEnabled()) {
      throw new ForbiddenException('BOT module is disabled in this environment');
    }
    if (tenantSlug !== BOT_DEMO_TENANT_SLUG) {
      throw new ForbiddenException(`BOT runs only on tenant "${BOT_DEMO_TENANT_SLUG}"`);
    }
    const access = await this.accessCtx.resolve(userId, tenantSlug);
    if (access.membershipRole !== MembershipRole.tenant_admin) {
      throw new ForbiddenException('BOT requires tenant_admin on demo tenant');
    }
    return access;
  }

  async resolveDivisionClientIds(tenantId: string, division: BotDivision): Promise<string[]> {
    const codes = divisionClientCodes(division);
    const rows = await this.prisma.client.findMany({
      where: {
        tenantId,
        OR: codes.map((code) => ({ code: { equals: code, mode: 'insensitive' as const } })),
      },
      select: { id: true, code: true },
    });
    if (rows.length === 0 && division !== 'tenant_wide') {
      throw new NotFoundException(
        `No demo clients for division "${division}". Run npm run db:seed first.`,
      );
    }
    return rows.map((r) => r.id);
  }
}
