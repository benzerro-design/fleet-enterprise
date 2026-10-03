import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_WRITE_ROLES } from '../iam/role-sets';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('jobs')
  @Roles(...FLEET_WRITE_ROLES)
  listJobs(@TenantId() tenantSlug: string, @CurrentAccess() access: AccessContext) {
    return this.imports.listJobs(tenantSlug, access);
  }

  @Post('run')
  @Roles(...FLEET_WRITE_ROLES)
  run(
    @TenantId() tenantSlug: string,
    @Body()
    body: {
      entity?: string;
      templateId?: string | null;
      csvText?: string;
      dryRun?: boolean;
      fileName?: string | null;
    },
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    if (!body?.entity?.trim()) throw new BadRequestException('entity is required');
    if (!body?.csvText?.trim()) throw new BadRequestException('csvText is required');
    return this.imports.run(
      tenantSlug,
      {
        entity: body.entity,
        templateId: body.templateId,
        csvText: body.csvText,
        dryRun: body.dryRun,
        fileName: body.fileName,
      },
      actorUserId,
      access,
    );
  }
}
