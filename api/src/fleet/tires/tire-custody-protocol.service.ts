import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  Prisma,
  TireCustodyMediaKind,
  TireCustodyProtocolKind,
  TireCustodyProtocolStatus,
  TireCustodySignerRole,
} from '@prisma/client';
import { createHash } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import type { AccessContext } from '../../iam/access-context.types';
import { assertPartnerWrite, resolvePartnerSupplierIdsFilter } from '../../iam/partner-access';
import { PrismaService } from '../../prisma/prisma.service';
import { assertSupplierReadById } from '../../suppliers/supplier-access';
import { assertSupplierTireStorage } from '../../suppliers/supplier-tire-capability';
import {
  assertTireCustodyArchiveReady,
  TIRE_CUSTODY_MIN_MEDIA,
} from './tire-custody-archive';
import { assertTireCustodyFinalizeRoles } from './tire-custody-finalize';
import { tireSetQrPayload } from './tire-domain.types';
import {
  hashTireCustodySecret,
  mintDriverInviteSecrets,
  verifyDriverInvite,
} from './tire-custody-invite';
import { buildTireCustodyPdf } from './tire-custody-pdf';
import {
  isStockReleasingCustodyKind,
  releaseKindForCustodyProtocol,
  STOCK_RELEASE_CUSTODY_KINDS,
} from './tire-custody-release-map';
import { loadSignatureImageBuffer } from './tire-custody-signature-image';
import { TireHotelService, type TireHotelReleaseKind } from './tire-hotel.service';
import { formatStayLocation, parseStayLocation } from './tire-stay-location';
import { buildPublicUrl } from '../../web-origin';

const DEFAULT_CHECKLIST: Record<string, boolean> = {
  set_complete: false,
  tread_noted: false,
  photos_taken: false,
  bay_assigned: false,
  counterparty_id_checked: false,
};

const PROTOCOL_INCLUDE = {
  signatures: true,
  media: true,
  set: {
    select: {
      name: true,
      season: true,
      vehicle: { select: { registrationNumber: true } },
    },
  },
} as const;

export type TireCustodyProtocolRecord = {
  id: string;
  stayId: string;
  setId: string;
  supplierId: string;
  workOrderId: string | null;
  kind: TireCustodyProtocolKind;
  revision: number;
  status: TireCustodyProtocolStatus;
  locationText: string | null;
  conditionNotes: string | null;
  inventoryNotes: string | null;
  checklist: Record<string, boolean>;
  counterpartyName: string | null;
  counterpartyRoleNote: string | null;
  signedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  pdfSha256: string | null;
  pdfArchivedAt: string | null;
  hasArchivedPdf: boolean;
  hasDriverInvite: boolean;
  driverInviteExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  plate: string | null;
  setName: string | null;
  season: string | null;
  signatures: Array<{
    id: string;
    role: TireCustodySignerRole;
    displayName: string;
    signedAt: string;
    signaturePngUrl: string;
  }>;
  media: Array<{
    id: string;
    kind: TireCustodyMediaKind;
    fileUrl: string;
    fileName: string | null;
    caption: string | null;
    capturedAt: string;
  }>;
};

export type TireCustodyProtocolSummary = {
  kind: TireCustodyProtocolKind;
  status: TireCustodyProtocolStatus;
  revision: number;
  signedAt: string | null;
  pdfSha256: string | null;
};

@Injectable()
export class TireCustodyProtocolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hotel: TireHotelService,
  ) {}

  private async resolvePartnerSupplier(
    tenantSlug: string,
    access: AccessContext | undefined,
    supplierId?: string,
  ): Promise<{ tenantId: string; tenantName: string; supplierId: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const ids = resolvePartnerSupplierIdsFilter(
      access,
      supplierId ? [supplierId] : undefined,
    );
    const sid = ids?.length === 1 ? ids[0]! : supplierId?.trim();
    if (!sid) throw new BadRequestException('supplierId is required');
    if (access) await assertSupplierReadById(this.prisma, tenantSlug, sid, access);
    await assertSupplierTireStorage(this.prisma, tenant.id, sid);
    return { tenantId: tenant.id, tenantName: tenant.name, supplierId: sid };
  }

  private assertStaySupplier(
    stay: { supplierId: string; tenantId: string },
    supplierId: string,
    tenantId: string,
  ) {
    if (stay.tenantId !== tenantId || stay.supplierId !== supplierId) {
      throw new NotFoundException('Stay not found');
    }
  }

  private toProtocol(row: {
    id: string;
    stayId: string;
    setId: string;
    supplierId: string;
    workOrderId: string | null;
    kind: TireCustodyProtocolKind;
    revision: number;
    status: TireCustodyProtocolStatus;
    locationText: string | null;
    conditionNotes: string | null;
    inventoryNotes: string | null;
    checklistJson: Prisma.JsonValue;
    counterpartyName: string | null;
    counterpartyRoleNote: string | null;
    signedAt: Date | null;
    voidedAt: Date | null;
    voidReason: string | null;
    pdfSha256: string | null;
    pdfArchivedAt: Date | null;
    pdfBytes?: Buffer | Uint8Array | null;
    driverInviteTokenHash?: string | null;
    driverInviteExpiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    signatures: Array<{
      id: string;
      role: TireCustodySignerRole;
      displayName: string;
      signedAt: Date;
      signaturePngUrl: string;
    }>;
    media?: Array<{
      id: string;
      kind: TireCustodyMediaKind;
      fileUrl: string;
      fileName: string | null;
      caption: string | null;
      capturedAt: Date;
    }>;
    set?: {
      name: string | null;
      season: string;
      vehicle?: { registrationNumber: string } | null;
    } | null;
  }): TireCustodyProtocolRecord {
    const checklist =
      row.checklistJson && typeof row.checklistJson === 'object' && !Array.isArray(row.checklistJson)
        ? (row.checklistJson as Record<string, boolean>)
        : { ...DEFAULT_CHECKLIST };
    return {
      id: row.id,
      stayId: row.stayId,
      setId: row.setId,
      supplierId: row.supplierId,
      workOrderId: row.workOrderId,
      kind: row.kind,
      revision: row.revision,
      status: row.status,
      locationText: row.locationText,
      conditionNotes: row.conditionNotes,
      inventoryNotes: row.inventoryNotes,
      checklist,
      counterpartyName: row.counterpartyName,
      counterpartyRoleNote: row.counterpartyRoleNote,
      signedAt: row.signedAt?.toISOString() ?? null,
      voidedAt: row.voidedAt?.toISOString() ?? null,
      voidReason: row.voidReason,
      pdfSha256: row.pdfSha256,
      pdfArchivedAt: row.pdfArchivedAt?.toISOString() ?? null,
      hasArchivedPdf: Boolean(row.pdfBytes && row.pdfSha256),
      hasDriverInvite: Boolean(
        row.driverInviteTokenHash &&
          row.driverInviteExpiresAt &&
          row.driverInviteExpiresAt.getTime() > Date.now(),
      ),
      driverInviteExpiresAt: row.driverInviteExpiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      plate: row.set?.vehicle?.registrationNumber ?? null,
      setName: row.set?.name ?? null,
      season: row.set?.season ?? null,
      signatures: row.signatures.map((s) => ({
        id: s.id,
        role: s.role,
        displayName: s.displayName,
        signedAt: s.signedAt.toISOString(),
        signaturePngUrl: s.signaturePngUrl,
      })),
      media: (row.media ?? []).map((m) => ({
        id: m.id,
        kind: m.kind,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        caption: m.caption,
        capturedAt: m.capturedAt.toISOString(),
      })),
    };
  }

  /** Active (non-voided) summaries for stay list badges. */
  async summariesForStays(
    tenantId: string,
    stayIds: string[],
  ): Promise<Map<string, TireCustodyProtocolSummary[]>> {
    const map = new Map<string, TireCustodyProtocolSummary[]>();
    if (!stayIds.length) return map;
    const rows = await this.prisma.tireCustodyProtocol.findMany({
      where: {
        tenantId,
        stayId: { in: stayIds },
        status: { not: TireCustodyProtocolStatus.voided },
      },
      select: {
        stayId: true,
        kind: true,
        status: true,
        revision: true,
        signedAt: true,
        pdfSha256: true,
      },
      orderBy: [{ revision: 'desc' }],
    });
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.stayId}:${r.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const list = map.get(r.stayId) ?? [];
      list.push({
        kind: r.kind,
        status: r.status,
        revision: r.revision,
        signedAt: r.signedAt?.toISOString() ?? null,
        pdfSha256: r.pdfSha256,
      });
      map.set(r.stayId, list);
    }
    return map;
  }

  private async assertArchivedKind(
    tenantId: string,
    stayId: string,
    kind: TireCustodyProtocolKind,
    label: string,
  ): Promise<void> {
    const row = await this.prisma.tireCustodyProtocol.findFirst({
      where: {
        tenantId,
        stayId,
        kind,
        status: { not: TireCustodyProtocolStatus.voided },
      },
      orderBy: { revision: 'desc' },
      select: { status: true, pdfSha256: true, pdfBytes: true },
    });
    const ready = row
      ? assertTireCustodyArchiveReady(row)
      : { ok: false as const, message: `${label} protocol missing` };
    if (!ready.ok) {
      throw new BadRequestException(
        `${label}: ${ready.message}. Open PV ${kind}, collect bilateral signatures + photo, finalize.`,
      );
    }
  }

  /** Gate hotel check-out: signed archived check_in + (check_out OR stock-release PV). */
  async assertSignedCheckOutProtocol(tenantId: string, stayId: string): Promise<void> {
    await this.assertArchivedKind(
      tenantId,
      stayId,
      TireCustodyProtocolKind.check_in,
      'Check-in custody',
    );

    for (const kind of STOCK_RELEASE_CUSTODY_KINDS) {
      const row = await this.prisma.tireCustodyProtocol.findFirst({
        where: {
          tenantId,
          stayId,
          kind,
          status: { not: TireCustodyProtocolStatus.voided },
        },
        orderBy: { revision: 'desc' },
        select: { status: true, pdfSha256: true, pdfBytes: true },
      });
      if (row && assertTireCustodyArchiveReady(row).ok) {
        return;
      }
    }
    throw new BadRequestException(
      'Check-out requires a signed archived release PV (check_out, scrap, transfer, leasing_return, or quarantine).',
    );
  }

  async getOrCreateForStay(
    tenantSlug: string,
    stayId: string,
    kind: TireCustodyProtocolKind,
    access: AccessContext | undefined,
    supplierId?: string,
    opts?: { workOrderId?: string | null; actorUserId?: string | null },
  ): Promise<TireCustodyProtocolRecord> {
    if (access) assertPartnerWrite(access);
    const { tenantId, supplierId: sid } = await this.resolvePartnerSupplier(
      tenantSlug,
      access,
      supplierId,
    );
    const stay = await this.prisma.tireStorageStay.findFirst({
      where: { id: stayId, tenantId },
      include: {
        set: { select: { id: true, name: true, season: true } },
      },
    });
    if (!stay) throw new NotFoundException('Stay not found');
    this.assertStaySupplier(stay, sid, tenantId);

    const parsed = parseStayLocation(stay.locationCode);
    const locationText =
      formatStayLocation(parsed.bayCode, parsed.binCode) || stay.locationCode || null;

    let workOrderId: string | null | undefined = opts?.workOrderId;
    if (workOrderId !== undefined && workOrderId !== null) {
      const wo = workOrderId.trim();
      if (!wo) workOrderId = null;
      else {
        const found = await this.prisma.maintenanceWorkOrder.findFirst({
          where: { id: wo, tenantId },
          select: { id: true },
        });
        if (!found) throw new BadRequestException('workOrderId not found');
        workOrderId = found.id;
      }
    }

    const active = await this.prisma.tireCustodyProtocol.findFirst({
      where: {
        stayId,
        kind,
        status: { not: TireCustodyProtocolStatus.voided },
      },
      orderBy: { revision: 'desc' },
      include: PROTOCOL_INCLUDE,
    });
    if (active) {
      if (workOrderId !== undefined && active.status === TireCustodyProtocolStatus.draft) {
        const row = await this.prisma.tireCustodyProtocol.update({
          where: { id: active.id },
          data: { workOrderId },
          include: PROTOCOL_INCLUDE,
        });
        return this.toProtocol(row);
      }
      return this.toProtocol(active);
    }

    const maxRev = await this.prisma.tireCustodyProtocol.aggregate({
      where: { stayId, kind },
      _max: { revision: true },
    });
    const revision = (maxRev._max.revision ?? 0) + 1;

    const row = await this.prisma.tireCustodyProtocol.create({
      data: {
        tenantId,
        stayId,
        setId: stay.setId,
        supplierId: sid,
        kind,
        revision,
        checklistJson: DEFAULT_CHECKLIST,
        locationText,
        conditionNotes: stay.intakeTreadNotes,
        workOrderId: workOrderId ?? null,
      },
      include: PROTOCOL_INCLUDE,
    });

    // Seed intake media from stay photos only for check_in (not check_out/seasonal).
    if (kind === TireCustodyProtocolKind.check_in) {
      const photos = Array.isArray(stay.intakePhotos)
        ? stay.intakePhotos.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        : [];
      if (photos.length) {
        await this.prisma.tireCustodyMedia.createMany({
          data: photos.slice(0, 12).map((fileUrl) => ({
            tenantId,
            protocolId: row.id,
            kind: TireCustodyMediaKind.intake,
            fileUrl,
          })),
        });
      }
    }

    await this.audit.log({
      tenantId,
      actorUserId: opts?.actorUserId,
      action: 'tire_custody_protocol.create',
      entityType: 'tire_custody_protocol',
      entityId: row.id,
      meta: { kind, stayId, revision },
    });

    return this.getProtocol(tenantSlug, row.id, access);
  }

  async listForStay(
    tenantSlug: string,
    stayId: string,
    access: AccessContext | undefined,
    supplierId?: string,
  ): Promise<{ items: TireCustodyProtocolRecord[] }> {
    const { tenantId, supplierId: sid } = await this.resolvePartnerSupplier(
      tenantSlug,
      access,
      supplierId,
    );
    const stay = await this.prisma.tireStorageStay.findFirst({
      where: { id: stayId, tenantId },
      select: { id: true, tenantId: true, supplierId: true },
    });
    if (!stay) throw new NotFoundException('Stay not found');
    this.assertStaySupplier(stay, sid, tenantId);

    const rows = await this.prisma.tireCustodyProtocol.findMany({
      where: { tenantId, stayId },
      include: PROTOCOL_INCLUDE,
      orderBy: [{ kind: 'asc' }, { revision: 'asc' }],
    });
    return { items: rows.map((r) => this.toProtocol(r)) };
  }

  async getProtocol(
    tenantSlug: string,
    protocolId: string,
    access: AccessContext | undefined,
  ): Promise<TireCustodyProtocolRecord> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const row = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: PROTOCOL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, row.supplierId, access);
    }
    return this.toProtocol(row);
  }

  async patchProtocol(
    tenantSlug: string,
    protocolId: string,
    input: {
      locationText?: string | null;
      conditionNotes?: string | null;
      inventoryNotes?: string | null;
      checklist?: Record<string, boolean>;
      counterpartyName?: string | null;
      counterpartyRoleNote?: string | null;
      workOrderId?: string | null;
    },
    access: AccessContext | undefined,
    actorUserId?: string | null,
  ): Promise<TireCustodyProtocolRecord> {
    if (access) assertPartnerWrite(access);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, existing.supplierId, access);
    }
    if (existing.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Only draft protocols can be edited');
    }

    const data: Prisma.TireCustodyProtocolUncheckedUpdateInput = {};
    if (input.locationText !== undefined) {
      data.locationText = input.locationText?.trim() || null;
    }
    if (input.conditionNotes !== undefined) {
      data.conditionNotes = input.conditionNotes?.trim() || null;
    }
    if (input.inventoryNotes !== undefined) {
      data.inventoryNotes = input.inventoryNotes?.trim() || null;
    }
    if (input.checklist !== undefined) {
      data.checklistJson = input.checklist as Prisma.InputJsonValue;
    }
    if (input.counterpartyName !== undefined) {
      data.counterpartyName = input.counterpartyName?.trim() || null;
    }
    if (input.counterpartyRoleNote !== undefined) {
      data.counterpartyRoleNote = input.counterpartyRoleNote?.trim() || null;
    }
    if (input.workOrderId !== undefined) {
      const wo = input.workOrderId?.trim() || null;
      if (wo) {
        const found = await this.prisma.maintenanceWorkOrder.findFirst({
          where: { id: wo, tenantId: tenant.id },
          select: { id: true },
        });
        if (!found) throw new BadRequestException('workOrderId not found');
        data.workOrderId = found.id;
      } else {
        data.workOrderId = null;
      }
    }

    const row = await this.prisma.tireCustodyProtocol.update({
      where: { id: protocolId },
      data,
      include: PROTOCOL_INCLUDE,
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tire_custody_protocol.patch',
      entityType: 'tire_custody_protocol',
      entityId: protocolId,
      meta: input as Prisma.InputJsonValue,
    });

    return this.toProtocol(row);
  }

  async addSignature(
    tenantSlug: string,
    protocolId: string,
    input: {
      role: TireCustodySignerRole;
      displayName: string;
      signaturePngUrl: string;
      strokePathJson?: Prisma.InputJsonValue | null;
      deviceMetaJson?: Prisma.InputJsonValue | null;
    },
    access: AccessContext | undefined,
    actorUserId?: string | null,
  ): Promise<TireCustodyProtocolRecord> {
    if (access) assertPartnerWrite(access);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: { signatures: true },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, existing.supplierId, access);
    }
    if (existing.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Protocol is not draft');
    }
    const name = input.displayName?.trim();
    const url = input.signaturePngUrl?.trim();
    if (!name || !url) throw new BadRequestException('displayName and signaturePngUrl required');
    if (existing.signatures.some((s) => s.role === input.role)) {
      throw new BadRequestException(`Signature for role ${input.role} already exists`);
    }

    await this.prisma.tireCustodySignature.create({
      data: {
        tenantId: tenant.id,
        protocolId,
        role: input.role,
        displayName: name,
        signaturePngUrl: url,
        strokePathJson: input.strokePathJson ?? undefined,
        deviceMetaJson: input.deviceMetaJson ?? undefined,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tire_custody_signature.create',
      entityType: 'tire_custody_protocol',
      entityId: protocolId,
      meta: { role: input.role },
    });

    return this.getProtocol(tenantSlug, protocolId, access);
  }

  async addMedia(
    tenantSlug: string,
    protocolId: string,
    input: {
      kind: TireCustodyMediaKind;
      fileUrl: string;
      fileName?: string | null;
      caption?: string | null;
    },
    access: AccessContext | undefined,
    actorUserId?: string | null,
  ): Promise<TireCustodyProtocolRecord> {
    if (access) assertPartnerWrite(access);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, existing.supplierId, access);
    }
    if (existing.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Protocol is not draft');
    }
    const fileUrl = input.fileUrl?.trim();
    if (!fileUrl) throw new BadRequestException('fileUrl required');

    await this.prisma.tireCustodyMedia.create({
      data: {
        tenantId: tenant.id,
        protocolId,
        kind: input.kind,
        fileUrl,
        fileName: input.fileName?.trim() || null,
        caption: input.caption?.trim() || null,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tire_custody_media.create',
      entityType: 'tire_custody_protocol',
      entityId: protocolId,
      meta: { kind: input.kind },
    });

    return this.getProtocol(tenantSlug, protocolId, access);
  }

  async voidProtocol(
    tenantSlug: string,
    protocolId: string,
    reason: string | null | undefined,
    access: AccessContext | undefined,
    actorUserId?: string | null,
  ): Promise<TireCustodyProtocolRecord> {
    if (access) assertPartnerWrite(access);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, existing.supplierId, access);
    }
    if (existing.status === TireCustodyProtocolStatus.voided) {
      throw new BadRequestException('Protocol already voided');
    }
    const voidReason = reason?.trim() || null;
    if (!voidReason) throw new BadRequestException('voidReason required');

    const row = await this.prisma.tireCustodyProtocol.update({
      where: { id: protocolId },
      data: {
        status: TireCustodyProtocolStatus.voided,
        voidedAt: new Date(),
        voidReason,
      },
      include: PROTOCOL_INCLUDE,
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tire_custody_protocol.void',
      entityType: 'tire_custody_protocol',
      entityId: protocolId,
      meta: { kind: existing.kind, revision: existing.revision, voidReason },
    });

    return this.toProtocol(row);
  }

  private async renderPdfBuffer(
    protocolId: string,
    tenantName: string,
    opts?: { signedAtOverride?: Date | null },
  ): Promise<Buffer> {
    const row = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId },
      include: {
        signatures: true,
        media: true,
        supplier: { select: { legalName: true } },
        stay: { select: { locationCode: true } },
        set: {
          select: {
            id: true,
            name: true,
            season: true,
            vehicle: { select: { registrationNumber: true } },
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                asset: {
                  select: {
                    brand: true,
                    model: true,
                    size: true,
                    dot: true,
                    treadMm: true,
                    serialOrQr: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Protocol not found');

    const parsed = parseStayLocation(row.stay.locationCode);
    const bayBin =
      formatStayLocation(parsed.bayCode, parsed.binCode) || row.stay.locationCode || null;

    const itemLines = row.set.items.map((it) => {
      const a = it.asset;
      const parts = [
        a.brand,
        a.model,
        a.size,
        a.dot ? `DOT ${a.dot}` : null,
        a.treadMm != null ? `${a.treadMm} mm` : null,
        a.serialOrQr,
      ].filter(Boolean);
      return parts.join(' · ') || 'anvelopă';
    });

    const signatures = await Promise.all(
      row.signatures.map(async (s) => ({
        role: s.role,
        displayName: s.displayName,
        signedAt: s.signedAt.toISOString(),
        imageBuffer: await loadSignatureImageBuffer(s.signaturePngUrl),
      })),
    );

    return buildTireCustodyPdf({
      kind: row.kind,
      tenantName,
      protocolId: row.id,
      stayId: row.stayId,
      plate: row.set.vehicle?.registrationNumber ?? null,
      setName: row.set.name,
      season: row.set.season,
      supplierName: row.supplier.legalName,
      locationText: row.locationText,
      bayBin,
      conditionNotes: row.conditionNotes,
      inventoryNotes: row.inventoryNotes,
      counterpartyName: row.counterpartyName,
      workOrderId: row.workOrderId,
      signedAt:
        (opts?.signedAtOverride ?? row.signedAt)?.toISOString() ?? new Date().toISOString(),
      qrPayload: tireSetQrPayload(row.set.id),
      itemLines,
      mediaCount: row.media.length,
      revision: row.revision,
      signatures,
    });
  }

  async createDriverInvite(
    tenantSlug: string,
    protocolId: string,
    access: AccessContext | undefined,
    actorUserId?: string | null,
  ): Promise<{
    protocolId: string;
    url: string;
    otp: string;
    expiresAt: string;
    protocol: TireCustodyProtocolRecord;
  }> {
    if (access) assertPartnerWrite(access);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: { signatures: true },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, existing.supplierId, access);
    }
    if (existing.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Only draft protocols can invite a driver');
    }
    if (existing.signatures.some((s) => s.role === TireCustodySignerRole.driver)) {
      throw new BadRequestException('Driver signature already present');
    }

    const minted = mintDriverInviteSecrets();
    await this.prisma.tireCustodyProtocol.update({
      where: { id: protocolId },
      data: {
        driverInviteTokenHash: minted.tokenHash,
        driverInviteExpiresAt: minted.expiresAt,
        driverOtpHash: minted.otpHash,
        driverOtpExpiresAt: minted.expiresAt,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tire_custody_protocol.driver_invite',
      entityType: 'tire_custody_protocol',
      entityId: protocolId,
      meta: { expiresAt: minted.expiresAt.toISOString() },
    });

    return {
      protocolId,
      url: buildPublicUrl(`/tire-custody/sign/${minted.token}`),
      otp: minted.otp,
      expiresAt: minted.expiresAt.toISOString(),
      protocol: await this.getProtocol(tenantSlug, protocolId, access),
    };
  }

  async previewByDriverToken(token: string) {
    const tokenHash = hashTireCustodySecret(token);
    const row = await this.prisma.tireCustodyProtocol.findFirst({
      where: { driverInviteTokenHash: tokenHash },
      include: {
        set: {
          select: {
            name: true,
            season: true,
            vehicle: { select: { registrationNumber: true } },
          },
        },
        supplier: { select: { legalName: true } },
        signatures: { select: { role: true } },
      },
    });
    if (!row) throw new NotFoundException('Invite not found');
    if (row.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Protocol is not open for signing');
    }
    if (!row.driverInviteExpiresAt || row.driverInviteExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Driver invite expired');
    }
    return {
      protocolId: row.id,
      kind: row.kind,
      revision: row.revision,
      plate: row.set.vehicle?.registrationNumber ?? null,
      setName: row.set.name,
      season: row.set.season,
      supplierName: row.supplier.legalName,
      locationText: row.locationText,
      expiresAt: row.driverInviteExpiresAt.toISOString(),
      hasDriverSignature: row.signatures.some((s) => s.role === TireCustodySignerRole.driver),
    };
  }

  async signAsDriverByToken(
    token: string,
    input: {
      otp: string;
      displayName: string;
      signaturePngUrl: string;
      strokePathJson?: Prisma.InputJsonValue | null;
      deviceMetaJson?: Prisma.InputJsonValue | null;
    },
  ): Promise<{ ok: true; protocolId: string }> {
    const tokenHash = hashTireCustodySecret(token);
    const row = await this.prisma.tireCustodyProtocol.findFirst({
      where: { driverInviteTokenHash: tokenHash },
      include: { signatures: true },
    });
    if (!row) throw new NotFoundException('Invite not found');
    if (row.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Protocol is not draft');
    }
    const verified = verifyDriverInvite({
      token,
      otp: input.otp ?? '',
      tokenHash: row.driverInviteTokenHash,
      otpHash: row.driverOtpHash,
      expiresAt: row.driverOtpExpiresAt ?? row.driverInviteExpiresAt,
    });
    if (!verified.ok) throw new BadRequestException(verified.message);

    if (row.signatures.some((s) => s.role === TireCustodySignerRole.driver)) {
      throw new BadRequestException('Driver signature already exists');
    }
    const name = input.displayName?.trim();
    const url = input.signaturePngUrl?.trim();
    if (!name || !url) throw new BadRequestException('displayName and signaturePngUrl required');
    if (url.startsWith('data:')) {
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(url)) {
        throw new BadRequestException('signaturePngUrl data URL must be png/jpeg/webp');
      }
      if (url.length > 400_000) {
        throw new BadRequestException('signaturePngUrl too large (max ~300KB image)');
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tireCustodySignature.create({
          data: {
            tenantId: row.tenantId,
            protocolId: row.id,
            role: TireCustodySignerRole.driver,
            displayName: name,
            signaturePngUrl: url,
            strokePathJson: input.strokePathJson ?? undefined,
            deviceMetaJson: input.deviceMetaJson ?? undefined,
          },
        });
        await tx.tireCustodyProtocol.update({
          where: { id: row.id },
          data: {
            driverInviteTokenHash: null,
            driverInviteExpiresAt: null,
            driverOtpHash: null,
            driverOtpExpiresAt: null,
            counterpartyName: row.counterpartyName ?? name,
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Driver signature already exists');
      }
      throw e;
    }

    await this.audit.log({
      tenantId: row.tenantId,
      action: 'tire_custody_signature.create',
      entityType: 'tire_custody_protocol',
      entityId: row.id,
      meta: { role: 'driver', via: 'otp_link' },
    });

    return { ok: true, protocolId: row.id };
  }

  async finalizeProtocol(
    tenantSlug: string,
    protocolId: string,
    access: AccessContext | undefined,
    actorUserId?: string | null,
  ): Promise<TireCustodyProtocolRecord> {
    if (access) assertPartnerWrite(access);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const existing = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      include: { signatures: true, media: true },
    });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, existing.supplierId, access);
    }
    if (existing.status !== TireCustodyProtocolStatus.draft) {
      throw new BadRequestException('Protocol already finalized');
    }
    const rolesCheck = assertTireCustodyFinalizeRoles(
      existing.signatures.map((s) => s.role),
    );
    if (!rolesCheck.ok) {
      throw new BadRequestException(rolesCheck.message);
    }
    if (existing.media.length < TIRE_CUSTODY_MIN_MEDIA) {
      throw new BadRequestException(
        `At least ${TIRE_CUSTODY_MIN_MEDIA} photo required before finalize`,
      );
    }

    // Preflight stock-releasing kinds before archive+release transaction.
    let stockRelease: TireHotelReleaseKind | null = null;
    if (isStockReleasingCustodyKind(existing.kind)) {
      await this.assertArchivedKind(
        tenant.id,
        existing.stayId,
        TireCustodyProtocolKind.check_in,
        'Check-in custody',
      );
      stockRelease = releaseKindForCustodyProtocol(existing.kind);
      if (!stockRelease) {
        throw new BadRequestException('Internal: missing release mapping');
      }
      const openStay = await this.prisma.tireStorageStay.findFirst({
        where: {
          id: existing.stayId,
          tenantId: tenant.id,
          checkOutAt: null,
        },
        select: { id: true },
      });
      if (!openStay) {
        throw new BadRequestException(
          'Stay already closed — cannot apply stock release from this protocol',
        );
      }
    }

    const signedAt = new Date();
    // Build PDF before DB commit (signedAt override; status still draft).
    const pdfBuf = await this.renderPdfBuffer(protocolId, tenant.name, {
      signedAtOverride: signedAt,
    });
    const pdfSha256 = createHash('sha256').update(pdfBuf).digest('hex');
    const checklistJson = {
      ...((existing.checklistJson as Record<string, boolean>) ?? {}),
      photos_taken: true,
    };

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tireCustodyProtocol.update({
        where: { id: protocolId },
        data: {
          status: TireCustodyProtocolStatus.signed,
          signedAt,
          pdfBytes: new Uint8Array(pdfBuf),
          pdfSha256,
          pdfArchivedAt: new Date(),
          checklistJson,
        },
        include: PROTOCOL_INCLUDE,
      });
      if (stockRelease) {
        await this.hotel.checkOutTx(tx, {
          tenantId: tenant.id,
          supplierId: existing.supplierId,
          stayId: existing.stayId,
          actorUserId: actorUserId ?? null,
          releaseKind: stockRelease,
        });
      }
      return updated;
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tire_custody_protocol.finalize',
      entityType: 'tire_custody_protocol',
      entityId: protocolId,
      meta: {
        kind: existing.kind,
        revision: existing.revision,
        pdfSha256,
        stockRelease,
      },
    });

    return this.toProtocol({
      ...row,
      pdfBytes: row.pdfBytes ? Buffer.from(row.pdfBytes) : null,
    });
  }

  async downloadPdf(
    tenantSlug: string,
    protocolId: string,
    access: AccessContext | undefined,
  ): Promise<StreamableFile> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Protocol not found');
    const row = await this.prisma.tireCustodyProtocol.findFirst({
      where: { id: protocolId, tenantId: tenant.id },
      select: {
        id: true,
        kind: true,
        status: true,
        supplierId: true,
        pdfBytes: true,
        pdfSha256: true,
      },
    });
    if (!row) throw new NotFoundException('Protocol not found');
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, row.supplierId, access);
    }
    if (row.status !== TireCustodyProtocolStatus.signed) {
      throw new BadRequestException('PDF available after protocol is signed');
    }
    if (!row.pdfBytes || row.pdfBytes.length === 0 || !row.pdfSha256) {
      throw new BadRequestException('Archived PDF missing — re-finalize or void+rectify');
    }

    const buf = Buffer.from(row.pdfBytes);

    return new StreamableFile(buf, {
      type: 'application/pdf',
      disposition: `attachment; filename="tire-custody-${row.kind}-${row.id}.pdf"`,
    });
  }
}
