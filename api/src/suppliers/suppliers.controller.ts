import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { MembershipRole, SupplierCategory, SupplierStatus } from '@prisma/client';
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
import { ClientsService } from '../clients/clients.service';
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

function parseServiceTypeCode(raw?: string, legacyKind?: string): string | undefined {
  const v = (raw ?? legacyKind)?.trim();
  return v || undefined;
}

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly clients: ClientsService,
  ) {}

  @Get('catalog/services')
  @Roles(...FLEET_READ_ROLES)
  serviceCatalog(@TenantId() tenantSlug: string) {
    return this.suppliers.getServiceCatalog(tenantSlug);
  }

  @Get()
  @Roles(...FLEET_READ_ROLES)
  list(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('serviceTypeCode') serviceTypeCode?: string,
    @Query('serviceKind') serviceKind?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.suppliers.listPaged(
      tenantSlug,
      {
        page,
        pageSize,
        q: q?.trim(),
        status: parseStatus(status),
        category: parseCategory(category),
        serviceTypeCode: parseServiceTypeCode(serviceTypeCode, serviceKind),
      },
      access,
    );
  }

  @Get('stats')
  @Roles(...FLEET_READ_ROLES)
  stats(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('serviceTypeCode') serviceTypeCode?: string,
    @Query('serviceKind') serviceKind?: string,
  ) {
    return this.suppliers.getStats(
      tenantSlug,
      {
        q: q?.trim(),
        status: parseStatus(status),
        category: parseCategory(category),
        serviceTypeCode: parseServiceTypeCode(serviceTypeCode, serviceKind),
      },
      access,
    );
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

  @Get(':id/client-allocations')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listClientAllocations(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.clients.listClientAllocationsForSupplier(tenantSlug, id, access);
  }

  @Get(':id/documents')
  @Roles(...FLEET_READ_ROLES)
  listDocuments(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.suppliers.listDocuments(tenantSlug, id, access);
  }

  @Post(':id/documents')
  @Roles(MembershipRole.tenant_admin, MembershipRole.supplier_user)
  @HttpCode(201)
  createDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body()
    body: {
      kind?: string;
      title?: string;
      fileUrl?: string;
      fileName?: string;
      mimeType?: string | null;
      expiresOn?: string | null;
      required?: boolean;
    },
    @CurrentUserId() actorUserId: string | undefined,
    @CurrentAccess() access: AccessContext,
  ) {
    if (!body?.title?.trim() || !body?.fileUrl?.trim() || !body?.fileName?.trim()) {
      throw new BadRequestException('title, fileUrl and fileName required');
    }
    return this.suppliers.createDocument(
      tenantSlug,
      id,
      {
        kind: body.kind,
        title: body.title,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        mimeType: body.mimeType,
        expiresOn: body.expiresOn,
        required: body.required,
      },
      actorUserId,
      access,
    );
  }

  @Patch(':id/documents/:documentId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.supplier_user)
  patchDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body()
    body: {
      kind?: string;
      title?: string;
      expiresOn?: string | null;
      required?: boolean;
    },
    @CurrentAccess() access: AccessContext,
  ) {
    return this.suppliers.patchDocument(tenantSlug, id, documentId, body ?? {}, access);
  }

  @Delete(':id/documents/:documentId')
  @Roles(MembershipRole.tenant_admin, MembershipRole.supplier_user)
  @HttpCode(204)
  async deleteDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    await this.suppliers.deleteDocument(tenantSlug, id, documentId, access);
  }

  @Put(':id/client-allocations')
  @Roles(MembershipRole.tenant_admin)
  replaceClientAllocations(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: { clientIds?: string[] },
    @CurrentUserId() actorUserId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.clients.replaceClientAllocationsForSupplier(
      tenantSlug,
      id,
      Array.isArray(body?.clientIds) ? body.clientIds : [],
      actorUserId,
      access,
    );
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
