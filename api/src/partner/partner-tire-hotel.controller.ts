import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  TireCustodyMediaKind,
  TireCustodyProtocolKind,
  TireCustodySignerRole,
} from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TireCustodyProtocolService } from '../fleet/tires/tire-custody-protocol.service';
import { TenantId } from '../fleet/tenant-id.decorator';
import { CurrentAccess } from '../iam/current-access.decorator';
import type { AccessContext } from '../iam/access-context.types';
import { parseSupplierIdsQuery } from '../iam/partner-access';
import { FLEET_READ_ROLES, FLEET_WRITE_ROLES } from '../iam/role-sets';
import { sendTireCustodySmsOtp } from '../fleet/tires/tire-custody-sms';
import { PartnerMailService } from './partner-mail.service';
import { PartnerTireHotelService } from './partner-tire-hotel.service';
import { TireLedgerService } from '../fleet/tires/tire-ledger.service';

type AuthedRequest = Request & { user?: { id?: string } };

@Controller('partner/tire-hotel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerTireHotelController {
  constructor(
    private readonly hotel: PartnerTireHotelService,
    private readonly custody: TireCustodyProtocolService,
    private readonly mail: PartnerMailService,
    private readonly tireLedger: TireLedgerService,
  ) {}

  @Get('capability')
  @Roles(...FLEET_READ_ROLES)
  capability(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.hotel.capability(tenantSlug, access, supplierId?.trim());
  }

  @Get('stays')
  @Roles(...FLEET_READ_ROLES)
  listStays(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('plate') plate?: string,
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('overview') overview?: string,
  ) {
    const takeN = take != null && take !== '' ? Number(take) : undefined;
    const skipN = skip != null && skip !== '' ? Number(skip) : undefined;
    return this.hotel.listActiveStays(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      plate: plate?.trim(),
      status: status?.trim(),
      take: Number.isFinite(takeN) ? takeN : undefined,
      skip: Number.isFinite(skipN) ? skipN : undefined,
      overview: overview === '1' || overview === 'true',
    });
  }

  @Get('ledger/vehicle/:vehicleId')
  @Roles(...FLEET_READ_ROLES)
  ledgerVehicle(
    @TenantId() tenantSlug: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.tireLedger.ledgerForVehicle(tenantSlug, vehicleId.trim(), access);
  }

  @Get('ledger/asset/:assetId')
  @Roles(...FLEET_READ_ROLES)
  ledgerAsset(
    @TenantId() tenantSlug: string,
    @Param('assetId') assetId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.tireLedger.ledgerForAsset(tenantSlug, assetId.trim(), access);
  }

  @Get('ledger/client/:clientId')
  @Roles(...FLEET_READ_ROLES)
  ledgerClient(
    @TenantId() tenantSlug: string,
    @Param('clientId') clientId: string,
    @CurrentAccess() access: AccessContext,
  ) {
    return this.tireLedger.ledgerForClient(tenantSlug, clientId.trim(), access);
  }

  @Get('requests')
  @Roles(...FLEET_READ_ROLES)
  listRequests(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
    @Query('take') take?: string,
  ) {
    const takeN = take != null && take !== '' ? Number(take) : undefined;
    const supplierIds = parseSupplierIdsQuery(supplierId, suppliers);
    return this.hotel.listTireRequests(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      supplierIds,
      take: Number.isFinite(takeN) ? takeN : undefined,
    });
  }

  @Get('requests/meta')
  @Roles(...FLEET_READ_ROLES)
  requestCreateMeta(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
  ) {
    return this.hotel.listRequestCreateMeta(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      supplierIds: parseSupplierIdsQuery(supplierId, suppliers),
    });
  }

  @Post('requests')
  @Roles(...FLEET_WRITE_ROLES)
  createRequest(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.createTireRequest(tenantSlug, access, body, req.user?.id);
  }

  @Get('requests/:ticketId')
  @Roles(...FLEET_READ_ROLES)
  getRequest(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('ticketId') ticketId: string,
    @Query('supplierId') supplierId?: string,
    @Query('suppliers') suppliers?: string,
  ) {
    return this.hotel.getTireRequest(tenantSlug, access, ticketId, {
      supplierId: supplierId?.trim(),
      supplierIds: parseSupplierIdsQuery(supplierId, suppliers),
    });
  }

  @Get('dashboard-stats')
  @Roles(...FLEET_READ_ROLES)
  dashboardStats(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.hotel.dashboardStats(tenantSlug, access, {
      supplierId: supplierId?.trim(),
    });
  }

  @Get('search')
  @Roles(...FLEET_READ_ROLES)
  search(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('plate') plate?: string,
  ) {
    return this.hotel.searchSetsForCheckIn(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      plate: plate ?? '',
    });
  }

  @Get('quote-fee')
  @Roles(...FLEET_READ_ROLES)
  quoteFee(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('setId') setId?: string,
  ) {
    return this.hotel.quoteFee(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      setId: setId ?? '',
    });
  }

  @Post('check-in')
  @Roles(...FLEET_WRITE_ROLES)
  checkIn(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.checkIn(tenantSlug, access, body, req.user?.id);
  }

  @Post('check-out')
  @Roles(...FLEET_WRITE_ROLES)
  checkOut(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.checkOut(tenantSlug, access, body, req.user?.id);
  }

  @Post('relocate')
  @Roles(...FLEET_WRITE_ROLES)
  relocate(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.relocate(tenantSlug, access, body, req.user?.id);
  }

  @Post('transfer')
  @Roles(...FLEET_WRITE_ROLES)
  transfer(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.hotel.transferStay(tenantSlug, access, body, req.user?.id);
  }

  @Post('transform-stay-to-cost')
  @Roles(...FLEET_WRITE_ROLES)
  transformStayToCost(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
  ) {
    return this.hotel.transformStayToCost(tenantSlug, access, body);
  }

  @Get('stays/:stayId/cost-summary')
  @Roles(...FLEET_READ_ROLES)
  stayCostSummary(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('stayId') stayId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.hotel.stayCostSummary(tenantSlug, access, stayId, supplierId?.trim());
  }

  @Patch('assets/:assetId')
  @Roles(...FLEET_WRITE_ROLES)
  patchTireAssetDocs(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ) {
    return this.hotel.patchTireAssetDocs(tenantSlug, access, assetId, body);
  }

  @Patch('sets/:setId/docs')
  @Roles(...FLEET_WRITE_ROLES)
  patchTireSetDocs(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('setId') setId: string,
    @Body() body: unknown,
  ) {
    return this.hotel.patchTireSetDocs(tenantSlug, access, setId, body);
  }

  @Get('stays.csv')
  @Roles(...FLEET_READ_ROLES)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tire-hotel-stays.csv"')
  async exportStaysCsv(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    return this.hotel.exportStaysCsv(tenantSlug, access, {
      supplierId: supplierId?.trim(),
      status: status?.trim(),
    });
  }

  @Post('import-sets/dry-run')
  @Roles(...FLEET_WRITE_ROLES)
  importSetsDryRun(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Body() body: unknown,
  ) {
    return this.hotel.importSetsDryRun(tenantSlug, access, body);
  }

  @Post('import-sets')
  @Roles(...FLEET_WRITE_ROLES)
  importSets(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    return this.hotel.importSets(tenantSlug, access, body, req.user?.id);
  }

  @Get('stays/:stayId/protocols')
  @Roles(...FLEET_READ_ROLES)
  listProtocols(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('stayId') stayId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.custody.listForStay(tenantSlug, stayId, access, supplierId?.trim());
  }

  @Post('stays/:stayId/protocols/:kind')
  @Roles(...FLEET_WRITE_ROLES)
  openProtocol(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('stayId') stayId: string,
    @Param('kind') kindRaw: string,
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @Query('supplierId') supplierId?: string,
  ) {
    const kind = parseCustodyKind(kindRaw);
    const workOrderId =
      typeof body.workOrderId === 'string' ? body.workOrderId : undefined;
    return this.custody.getOrCreateForStay(
      tenantSlug,
      stayId,
      kind,
      access,
      supplierId?.trim(),
      { workOrderId, actorUserId: req.user?.id },
    );
  }

  @Get('protocols/:id')
  @Roles(...FLEET_READ_ROLES)
  getProtocol(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
  ) {
    return this.custody.getProtocol(tenantSlug, id, access);
  }

  @Patch('protocols/:id')
  @Roles(...FLEET_WRITE_ROLES)
  patchProtocol(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest,
  ) {
    return this.custody.patchProtocol(
      tenantSlug,
      id,
      {
        locationText: body.locationText as string | null | undefined,
        conditionNotes: body.conditionNotes as string | null | undefined,
        inventoryNotes: body.inventoryNotes as string | null | undefined,
        checklist: body.checklist as Record<string, boolean> | undefined,
        counterpartyName: body.counterpartyName as string | null | undefined,
        counterpartyRoleNote: body.counterpartyRoleNote as string | null | undefined,
        workOrderId: body.workOrderId as string | null | undefined,
      },
      access,
      req.user?.id,
    );
  }

  @Post('protocols/:id/signatures')
  @Roles(...FLEET_WRITE_ROLES)
  addSignature(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest,
  ) {
    const role = parseSignerRole(String(body.role ?? ''));
    return this.custody.addSignature(
      tenantSlug,
      id,
      {
        role,
        displayName: String(body.displayName ?? ''),
        signaturePngUrl: String(body.signaturePngUrl ?? ''),
        strokePathJson: (body.strokePathJson as object | null | undefined) ?? undefined,
        deviceMetaJson: (body.deviceMetaJson as object | null | undefined) ?? undefined,
      },
      access,
      req.user?.id,
    );
  }

  @Post('protocols/:id/media')
  @Roles(...FLEET_WRITE_ROLES)
  addMedia(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest,
  ) {
    return this.custody.addMedia(
      tenantSlug,
      id,
      {
        kind: parseMediaKind(String(body.kind ?? 'other')),
        fileUrl: String(body.fileUrl ?? ''),
        fileName: (body.fileName as string | null | undefined) ?? null,
        caption: (body.caption as string | null | undefined) ?? null,
      },
      access,
      req.user?.id,
    );
  }

  @Post('protocols/:id/finalize')
  @Roles(...FLEET_WRITE_ROLES)
  finalizeProtocol(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.custody.finalizeProtocol(tenantSlug, id, access, req.user?.id);
  }

  @Post('protocols/:id/void')
  @Roles(...FLEET_WRITE_ROLES)
  voidProtocol(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest,
  ) {
    return this.custody.voidProtocol(
      tenantSlug,
      id,
      typeof body.voidReason === 'string' ? body.voidReason : null,
      access,
      req.user?.id,
    );
  }

  @Post('protocols/:id/driver-invite')
  @Roles(...FLEET_WRITE_ROLES)
  async driverInvite(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedRequest,
  ) {
    const invite = await this.custody.createDriverInvite(
      tenantSlug,
      id,
      access,
      req.user?.id,
    );
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone =
      typeof body.phone === 'string' ? body.phone.trim() : '';
    let emailSent = false;
    let emailError: string | null = null;
    let smsSent = false;
    let smsError: string | null = null;
    if (email) {
      try {
        await this.mail.sendDriverOtpInvite({
          to: email,
          otp: invite.otp,
          url: invite.url,
          expiresAt: invite.expiresAt,
          plate: invite.protocol.plate,
        });
        emailSent = true;
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'email failed';
      }
    }
    if (phone) {
      const sms = await sendTireCustodySmsOtp({
        to: phone,
        otp: invite.otp,
        url: invite.url,
        expiresAt: invite.expiresAt,
        plate: invite.protocol.plate,
        protocolId: invite.protocolId,
      });
      if (sms.sent) smsSent = true;
      else smsError = sms.error;
    }
    return { ...invite, emailSent, emailError, smsSent, smsError };
  }

  @Get('protocols/:id/pdf')
  @Roles(...FLEET_READ_ROLES)
  @Header('Content-Type', 'application/pdf')
  downloadPdf(
    @TenantId() tenantSlug: string,
    @CurrentAccess() access: AccessContext,
    @Param('id') id: string,
  ) {
    return this.custody.downloadPdf(tenantSlug, id, access);
  }
}

function parseCustodyKind(raw: string): TireCustodyProtocolKind {
  const v = raw?.trim();
  if (v === 'check_in') return TireCustodyProtocolKind.check_in;
  if (v === 'check_out') return TireCustodyProtocolKind.check_out;
  if (v === 'seasonal') return TireCustodyProtocolKind.seasonal;
  if (v === 'transfer') return TireCustodyProtocolKind.transfer;
  if (v === 'scrap') return TireCustodyProtocolKind.scrap;
  if (v === 'leasing_return') return TireCustodyProtocolKind.leasing_return;
  if (v === 'quarantine') return TireCustodyProtocolKind.quarantine;
  throw new BadRequestException(`Invalid protocol kind: ${raw}`);
}

function parseSignerRole(raw: string): TireCustodySignerRole {
  const v = raw?.trim();
  if (v === 'partner') return TireCustodySignerRole.partner;
  if (v === 'customer') return TireCustodySignerRole.customer;
  if (v === 'driver') return TireCustodySignerRole.driver;
  if (v === 'witness') return TireCustodySignerRole.witness;
  throw new BadRequestException(`Invalid signer role: ${raw}`);
}

function parseMediaKind(raw: string): TireCustodyMediaKind {
  const v = raw?.trim();
  if (v === 'intake') return TireCustodyMediaKind.intake;
  if (v === 'condition') return TireCustodyMediaKind.condition;
  if (v === 'label') return TireCustodyMediaKind.label;
  if (v === 'other') return TireCustodyMediaKind.other;
  throw new BadRequestException(`Invalid media kind: ${raw}`);
}
