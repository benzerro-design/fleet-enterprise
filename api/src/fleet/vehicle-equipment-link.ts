import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FLEET-027: FK opțional document/mentenanță/cost → echipare pe același vehicul.
 * `undefined` = nu schimba; `null` / `""` = scoate legătura.
 */
export async function resolveVehicleEquipmentIdForVehicle(
  prisma: PrismaService,
  vehicleId: string,
  equipmentId: string | null | undefined,
): Promise<string | null | undefined> {
  if (equipmentId === undefined) return undefined;
  if (equipmentId === null) return null;
  const trimmed = equipmentId.trim();
  if (!trimmed) return null;
  const eq = await prisma.vehicleEquipment.findFirst({
    where: { id: trimmed, vehicleId },
    select: { id: true },
  });
  if (!eq) {
    throw new BadRequestException('vehicleEquipmentId must belong to the selected vehicle');
  }
  return eq.id;
}
