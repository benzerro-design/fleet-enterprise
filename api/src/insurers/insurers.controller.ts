import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import type { CreateInsurerInput, PatchInsurerInput } from './insurers.service';
import { InsurersService } from './insurers.service';

@Controller('insurers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsurersController {
  constructor(private readonly insurers: InsurersService) {}

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
    @Query('q') q?: string,
    @Query('active') activeRaw?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw ?? '50', 10) || 50));
    let active: boolean | undefined;
    if (activeRaw === 'true') active = true;
    else if (activeRaw === 'false') active = false;
    else if (activeRaw?.trim()) throw new BadRequestException('active must be true or false');
    return this.insurers.list(tenantSlug, { page, pageSize, q, active }, access);
  }

  @Get(':id')
  @Roles(...FLEET_READ_ROLES)
  getById(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    return this.insurers.getById(tenantSlug, id, access);
  }

  @Post()
  @Roles(...FLEET_WRITE_ROLES)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateInsurerInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.insurers.create(tenantSlug, body ?? {}, actorUserId, access);
  }

  @Patch(':id')
  @Roles(...FLEET_WRITE_ROLES)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchInsurerInput,
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.insurers.patch(tenantSlug, id, body ?? {}, actorUserId, access);
  }
}
