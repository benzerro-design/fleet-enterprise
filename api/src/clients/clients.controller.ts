import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientStatus, MembershipRole } from '@prisma/client';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TenantId } from '../fleet/tenant-id.decorator';
import type { CreateClientInput, PatchClientInput } from './clients.service';
import { ClientsService } from './clients.service';
import type {
  CreateClientContactInput,
  CreateClientDocumentInput,
  PatchClientContactInput,
  PatchClientDocumentInput,
} from './client-attachments.service';
import { ClientAttachmentsService } from './client-attachments.service';
import { ClientSubscriptionsService } from './client-subscriptions.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly attachments: ClientAttachmentsService,
    private readonly subscriptions: ClientSubscriptionsService,
  ) {}

  @Get()
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  list(
    @TenantId() tenantSlug: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50), 200);
    return this.clients.listPaged(tenantSlug, {
      page,
      pageSize,
      q: q?.trim(),
      status: parseClientStatus(status),
    });
  }

  @Get('export')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="clients.csv"')
  export(
    @TenantId() tenantSlug: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    return this.clients.exportCsv(tenantSlug, {
      q: q?.trim(),
      status: parseClientStatus(status),
    });
  }

  @Get(':id/summary')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  summary(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.clients.getSummary(tenantSlug, id);
  }

  @Get(':id/subscriptions')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listSubscriptions(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.subscriptions.listForClient(tenantSlug, id);
  }

  @Get(':id/contacts')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listContacts(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.attachments.listContacts(tenantSlug, id);
  }

  @Post(':id/contacts')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  createContact(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateClientContactInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.attachments.createContact(tenantSlug, id, body, actorUserId);
  }

  @Patch(':id/contacts/:contactId')
  @Roles(MembershipRole.tenant_admin)
  patchContact(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() body: PatchClientContactInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.attachments.patchContact(tenantSlug, id, contactId, body, actorUserId);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async deleteContact(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.attachments.deleteContact(tenantSlug, id, contactId, actorUserId);
  }

  @Get(':id/documents')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  listDocuments(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.attachments.listDocuments(tenantSlug, id);
  }

  @Post(':id/documents')
  @Roles(MembershipRole.tenant_admin)
  @HttpCode(201)
  createDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: CreateClientDocumentInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.attachments.createDocument(tenantSlug, id, body, actorUserId);
  }

  @Patch(':id/documents/:documentId')
  @Roles(MembershipRole.tenant_admin)
  patchDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() body: PatchClientDocumentInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.attachments.patchDocument(tenantSlug, id, documentId, body, actorUserId);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async deleteDocument(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.attachments.deleteDocument(tenantSlug, id, documentId, actorUserId);
  }

  @Get(':id')
  @Roles(MembershipRole.tenant_admin, MembershipRole.tenant_viewer)
  get(@TenantId() tenantSlug: string, @Param('id') id: string) {
    return this.clients.getById(tenantSlug, id);
  }

  @Post()
  @Roles(MembershipRole.tenant_admin)
  create(
    @TenantId() tenantSlug: string,
    @Body() body: CreateClientInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.clients.create(tenantSlug, body, actorUserId);
  }

  @Patch(':id')
  @Roles(MembershipRole.tenant_admin)
  patch(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @Body() body: PatchClientInput,
    @CurrentUserId() actorUserId?: string,
  ) {
    return this.clients.patch(tenantSlug, id, body, actorUserId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(MembershipRole.tenant_admin)
  async remove(
    @TenantId() tenantSlug: string,
    @Param('id') id: string,
    @CurrentUserId() actorUserId?: string,
  ) {
    await this.clients.delete(tenantSlug, id, actorUserId);
  }
}

function parseClientStatus(raw: string | undefined): ClientStatus | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s === 'active' || s === 'inactive') return s;
  throw new BadRequestException('status must be active or inactive');
}
