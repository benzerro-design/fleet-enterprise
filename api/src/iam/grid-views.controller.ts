import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AccessContext } from './access-context.types';
import { CurrentAccess } from './current-access.decorator';
import { GridViewsService } from './grid-views.service';
import { FLEET_READ_ROLES } from './role-sets';

@Controller('iam/grid-views')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GridViewsController {
  constructor(private readonly gridViews: GridViewsService) {}

  @Get(':gridKey')
  @Roles(...FLEET_READ_ROLES)
  getDefault(@Param('gridKey') gridKey: string, @CurrentAccess() access: AccessContext) {
    return this.gridViews.getDefault(access.userId, access.tenantId, gridKey);
  }

  @Put(':gridKey')
  @Roles(...FLEET_READ_ROLES)
  putDefault(
    @Param('gridKey') gridKey: string,
    @Body() body: { layout?: unknown },
    @CurrentAccess() access: AccessContext,
  ) {
    return this.gridViews.upsertDefault(access.userId, access.tenantId, gridKey, body.layout);
  }
}
