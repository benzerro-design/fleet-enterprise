import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export function assertValidTripOdometer(input: {
  odometerStartKm?: number | null;
  odometerEndKm?: number | null;
}): void {
  const start = input.odometerStartKm;
  const end = input.odometerEndKm;

  if (start != null && (!Number.isFinite(start) || start < 0)) {
    throw new BadRequestException('Odometru start trebuie să fie un număr nenegativ.');
  }
  if (end != null && (!Number.isFinite(end) || end < 0)) {
    throw new BadRequestException('Odometru final trebuie să fie un număr nenegativ.');
  }
  if (start != null && end != null && end < start) {
    throw new BadRequestException('Odometru final nu poate fi sub odometru start.');
  }
}

export async function assertUniqueTripReference(
  prisma: PrismaService,
  tenantId: string,
  reference: string | null | undefined,
  excludeTripId?: string,
): Promise<void> {
  const ref = reference?.trim();
  if (!ref) return;

  const existing = await prisma.trip.findFirst({
    where: {
      tenantId,
      reference: { equals: ref, mode: 'insensitive' },
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictException(`Există deja o cursă cu referința „${ref}”.`);
  }
}
