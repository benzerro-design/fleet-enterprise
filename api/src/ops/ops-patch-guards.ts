import { ConflictException } from '@nestjs/common';

/** La PATCH, vehiculul înregistrării este imuabil. */
export function rejectOpsEntryVehicleIdChange(
  requestedVehicleId: string | undefined,
  existingVehicleId: string,
): void {
  if (requestedVehicleId !== undefined && requestedVehicleId !== existingVehicleId) {
    throw new ConflictException(
      'Vehiculul înregistrării nu poate fi modificat la editare. Ștergeți înregistrarea și creați una nouă pe vehiculul corect.',
    );
  }
}
