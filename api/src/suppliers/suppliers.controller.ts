import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole, SupplierCategory, SupplierServiceKind, SupplierStatus } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { assertPartnerSupplierId, assertPartnerWrite, isPartnerUser } from '../iam/partner-access';
import type { CreateSupplierInput, PatchSupplierInput } from './suppliers.service';
import { SuppliersService } from './suppliers.service';
import { supplierServiceCatalog } from './supplier-services';

function parseStatus(raw?: string): SupplierStatus | undefined {
  if (!raw?.trim()) return undefined;
  if (raw === 'active' || raw === 'inactive' || raw === 'blocked') return raw;
  throw new BadRequestException('Invalid status');
}

function parseCategory(raw?: string): SupplierCategory | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as SupplierCategory;
  if (
    v === 'service_auto' ||
    v === 'itp' ||
    v === 'fuel' ||
    v === 'tires' ||
    v === 'insurer' ||
    v === 'broker' ||
    v === 'dealer' ||
    v === 'roadside_assistance' ||
    v === 'rent' ||
    v === 'other'
  ) {
    return v;
  }
  throw new BadRequestException('Invalid category');
}

function parseServiceKind(raw?: string): SupplierServiceKind | undefined {
  if (!raw?.trim()) return undefined;
  const catalog = supplierServiceCatalog();
  const hit = catalog.find((c) => c.kind === raw.trim());
  if (!hit) throw new BadRequestException('Invalid service kind');
  return hit.kind;
}

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get('catalog/services')
  @Roles(...FLEET_READ_ROLES)
  serviceCatalog() {
    return supplierServiceCatalog();
  }

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('serviceKind') serviceKind?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.suppliers.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseStatus(status),
      category: parseCategory(category),
      serviceKind: parseServiceKind(serviceKind),
    });
  }

  @Get('export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="suppliers.csv"')
  export(
    @TenantId() tenantSlug: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.suppliers.exportCsv(tenantSlug, {
      q: q?.trim(),
      status: parseStatus(status),
      category: parseCategory(category),
    });
  }

  @Get(':id')
  @Roles(...FLEET_READ_ROLES)
  get(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.suppliers.getById(tenantSlug, id, access);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateSupplierInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.suppliers.create(tenantSlug, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchSupplierInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.suppliers.patch(tenantSlug, id, body, actorUserId);
  }

  @Put(':id/services')
  @Roles(MembershipRole.tenant_admin, MembershipRole.supplier_user)
  setServices(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: { services?: unknown },
    @CurrentUserId() actorUserId?: string,
    @CurrentAccess() access?: AccessContext,
  ) {
    if (access && isPartnerUser(access)) {
      assertPartnerSupplierId(access, id);
      assertPartnerWrite(access);
    } else if (!access || access.membershipRole !== MembershipRole.tenant_admin) {
      throw new ForbiddenException('Only tenant admin or partner can update supplier services');
    }
    return this.suppliers.setServices(tenantSlug, id, body.services, actorUserId, access);
  }
}
