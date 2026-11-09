import { Injectable, NotFoundException } from '@nestjs/common';
import { vehicleClientScope } from '../../iam/client-access';
import type { AccessContext } from '../../iam/access-context.types';
import { assertVehicleOpsRead } from '../../ops/ops-write-access';
import { PrismaService } from '../../prisma/prisma.service';
import type { TireLedgerMovement, TireLedgerPayload } from './tire-ledger.types';

const PLACEMENT_KIND_LABEL: Record<string, string> = {
  on_vehicle: 'Montată pe vehicul',
  at_client: 'La client (depozit)',
  at_supplier_hotel: 'Hotel furnizor',
  in_transit: 'În tranzit',
  scrap: 'Casată',
  quarantine: 'Carantină',
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  purchase: 'Achiziție',
  mount: 'Montaj',
  demount: 'Demontaj',
  rotate: 'Rotire',
  inspect: 'Inspecție',
  repair: 'Reparație',
  store: 'Depozitare',
  release: 'Eliberare',
  scrap: 'Casare',
  transfer: 'Transfer',
};

@Injectable()
export class TireLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mișcări anvelopă fără assert vehicul — apelantul trebuie să verifice accesul (ex. portal partener).
   */
  async ledgerForAssetAtTenant(tenantSlug: string, assetId: string): Promise<TireLedgerPayload> {
    const tenant = await this.requireTenant(tenantSlug);
    const asset = await this.prisma.tireAsset.findFirst({
      where: { id: assetId.trim(), tenantId: tenant.id },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.buildAssetLedger(tenant.id, asset.id);
  }

  async ledgerForAsset(
    tenantSlug: string,
    assetId: string,
    access: AccessContext,
  ): Promise<TireLedgerPayload> {
    const tenant = await this.requireTenant(tenantSlug);
    const asset = await this.prisma.tireAsset.findFirst({
      where: { id: assetId, tenantId: tenant.id },
      select: {
        id: true,
        setItems: {
          take: 1,
          select: { set: { select: { vehicleId: true } } },
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    const vehicleId = asset.setItems[0]?.set.vehicleId;
    if (vehicleId) {
      await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    }

    return this.buildAssetLedger(tenant.id, asset.id);
  }

  private async buildAssetLedger(tenantId: string, assetId: string): Promise<TireLedgerPayload> {
    const [placements, events, setLinks] = await Promise.all([
      this.prisma.tirePlacement.findMany({
        where: { tenantId, assetId },
        orderBy: { validFrom: 'asc' },
        include: {
          supplier: { select: { legalName: true } },
          vehicle: { select: { id: true, registrationNumber: true } },
        },
      }),
      this.prisma.tireEvent.findMany({
        where: { tenantId, assetId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          createdAt: true,
          vehicleId: true,
          setId: true,
          workOrderId: true,
          sourceSystem: true,
          vehicle: { select: { registrationNumber: true } },
        },
      }),
      this.prisma.tireSetItem.findMany({
        where: { assetId },
        select: { setId: true },
      }),
    ]);

    const setIds = [...new Set(setLinks.map((i) => i.setId))];
    const stays =
      setIds.length === 0
        ? []
        : await this.prisma.tireStorageStay.findMany({
            where: { tenantId, setId: { in: setIds } },
            orderBy: { checkInAt: 'asc' },
            include: {
              supplier: { select: { legalName: true } },
              set: {
                select: {
                  vehicleId: true,
                  vehicle: { select: { registrationNumber: true } },
                },
              },
            },
          });

    const movements = [
      ...placementMovements(placements),
      ...stayMovements(stays),
      ...eventMovements(events),
    ].sort((a, b) => a.at.localeCompare(b.at));

    return { entityType: 'asset', entityId: assetId, movements };
  }

  async ledgerForVehicle(
    tenantSlug: string,
    vehicleId: string,
    access: AccessContext,
  ): Promise<TireLedgerPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const tenant = await this.requireTenant(tenantSlug);
    return this.buildVehicleLedger(tenant.id, vehicleId);
  }

  async ledgerForClient(
    tenantSlug: string,
    clientId: string,
    access: AccessContext,
  ): Promise<TireLedgerPayload> {
    const tenant = await this.requireTenant(tenantSlug);
    const clientVehicleScope = vehicleClientScope(access);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId: tenant.id, clientId, ...clientVehicleScope },
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    if (vehicleIds.length === 0) {
      return { entityType: 'client', entityId: clientId, movements: [] };
    }

    const chunks = await Promise.all(
      vehicleIds.map((vid) => this.buildVehicleLedger(tenant.id, vid)),
    );
    const movements = chunks
      .flatMap((c) => c.movements)
      .sort((a, b) => a.at.localeCompare(b.at));

    return { entityType: 'client', entityId: clientId, movements };
  }

  private async buildVehicleLedger(
    tenantId: string,
    vehicleId: string,
  ): Promise<TireLedgerPayload> {
    const sets = await this.prisma.tireSet.findMany({
      where: { tenantId, vehicleId },
      select: { id: true },
    });
    const setIds = sets.map((s) => s.id);

    const [placements, events, stays] = await Promise.all([
      this.prisma.tirePlacement.findMany({
        where: { tenantId, vehicleId },
        orderBy: { validFrom: 'asc' },
        include: {
          supplier: { select: { legalName: true } },
          vehicle: { select: { id: true, registrationNumber: true } },
        },
      }),
      this.prisma.tireEvent.findMany({
        where: { tenantId, vehicleId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          createdAt: true,
          assetId: true,
          setId: true,
          workOrderId: true,
          sourceSystem: true,
          vehicle: { select: { registrationNumber: true } },
        },
      }),
      setIds.length === 0
        ? Promise.resolve([])
        : this.prisma.tireStorageStay.findMany({
            where: { tenantId, setId: { in: setIds } },
            orderBy: { checkInAt: 'asc' },
            include: {
              supplier: { select: { legalName: true } },
              set: {
                select: {
                  vehicleId: true,
                  vehicle: { select: { registrationNumber: true } },
                },
              },
            },
          }),
    ]);

    const movements = [
      ...placementMovements(placements),
      ...stayMovements(stays),
      ...eventMovements(events),
    ].sort((a, b) => a.at.localeCompare(b.at));

    return { entityType: 'vehicle', entityId: vehicleId, movements };
  }

  private async requireTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}

function placementMovements(
  placements: Array<{
    id: string;
    kind: string;
    validFrom: Date;
    validTo: Date | null;
    locationCode: string | null;
    assetId: string;
    setId: string | null;
    vehicleId: string | null;
    supplier?: { legalName: string } | null;
    vehicle?: { id: string; registrationNumber: string } | null;
  }>,
): TireLedgerMovement[] {
  const out: TireLedgerMovement[] = [];
  for (const p of placements) {
    const baseLabel = PLACEMENT_KIND_LABEL[p.kind] ?? p.kind;
    out.push({
      id: `pl-${p.id}-start`,
      at: p.validFrom.toISOString(),
      source: 'placement',
      kind: `${p.kind}_start`,
      label: `${baseLabel} (început)`,
      plate: p.vehicle?.registrationNumber ?? null,
      vehicleId: p.vehicleId,
      assetId: p.assetId,
      setId: p.setId,
      supplierName: p.supplier?.legalName ?? null,
      locationCode: p.locationCode,
    });
    if (p.validTo) {
      out.push({
        id: `pl-${p.id}-end`,
        at: p.validTo.toISOString(),
        source: 'placement',
        kind: `${p.kind}_end`,
        label: `${baseLabel} (sfârșit)`,
        plate: p.vehicle?.registrationNumber ?? null,
        vehicleId: p.vehicleId,
        assetId: p.assetId,
        setId: p.setId,
        supplierName: p.supplier?.legalName ?? null,
        locationCode: p.locationCode,
      });
    }
  }
  return out;
}

function stayMovements(
  stays: Array<{
    id: string;
    setId: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    locationCode: string | null;
    sourceSystem: string | null;
    supplier?: { legalName: string };
    set: { vehicleId: string; vehicle: { registrationNumber: string } };
  }>,
): TireLedgerMovement[] {
  const out: TireLedgerMovement[] = [];
  for (const s of stays) {
    out.push({
      id: `stay-${s.id}-in`,
      at: s.checkInAt.toISOString(),
      source: 'stay',
      kind: 'check_in',
      label: 'Check-in hotel anvelope',
      plate: s.set.vehicle.registrationNumber,
      vehicleId: s.set.vehicleId,
      setId: s.setId,
      stayId: s.id,
      supplierName: s.supplier?.legalName ?? null,
      locationCode: s.locationCode,
      sourceSystem: s.sourceSystem,
    });
    if (s.checkOutAt) {
      out.push({
        id: `stay-${s.id}-out`,
        at: s.checkOutAt.toISOString(),
        source: 'stay',
        kind: 'check_out',
        label: 'Check-out hotel anvelope',
        plate: s.set.vehicle.registrationNumber,
        vehicleId: s.set.vehicleId,
        setId: s.setId,
        stayId: s.id,
        supplierName: s.supplier?.legalName ?? null,
        locationCode: s.locationCode,
        sourceSystem: s.sourceSystem,
      });
    }
  }
  return out;
}

function eventMovements(
  events: Array<{
    id: string;
    type: string;
    createdAt: Date;
    vehicleId?: string | null;
    assetId?: string | null;
    setId?: string | null;
    workOrderId?: string | null;
    sourceSystem?: string | null;
    vehicle?: { registrationNumber: string } | null;
  }>,
): TireLedgerMovement[] {
  return events.map((e) => ({
    id: `ev-${e.id}`,
    at: e.createdAt.toISOString(),
    source: 'event' as const,
    kind: e.type,
    label: EVENT_TYPE_LABEL[e.type] ?? e.type,
    plate: e.vehicle?.registrationNumber ?? null,
    vehicleId: e.vehicleId ?? null,
    assetId: e.assetId ?? null,
    setId: e.setId ?? null,
    workOrderId: e.workOrderId ?? null,
    sourceSystem: e.sourceSystem ?? null,
  }));
}
