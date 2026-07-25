import { BadRequestException } from '@nestjs/common';
import {
  DamageInsurerPipelineStatus,
  DamagePayerType,
  RoadsideInterventionStatus,
  ServiceCaseWorkflowType,
  VehicleMovableState,
} from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type PrismaLike = Pick<PrismaService, 'mobilityAssignment' | 'roadsideIntervention'>;

export type DamageGateCase = {
  id: string;
  workflowType: ServiceCaseWorkflowType;
  damagePayerType: DamagePayerType | null;
  damageInsurerPipelineStatus: DamageInsurerPipelineStatus | null;
  damageInsurerAgreedAt: Date | null;
  vehicleMovable?: VehicleMovableState | null;
};

/** Gate pentru start reparație (status În lucru) — nu pentru recepție In service. */
export async function assertDamageReadyForRepair(
  prisma: PrismaLike,
  tenantId: string,
  sc: DamageGateCase,
): Promise<void> {
  if (sc.workflowType !== ServiceCaseWorkflowType.damage) return;

  const payer = sc.damagePayerType;
  const isClientPayer = payer === DamagePayerType.client;
  if (!isClientPayer) {
    const insurerReady =
      sc.damageInsurerPipelineStatus === DamageInsurerPipelineStatus.payment_accepted ||
      !!sc.damageInsurerAgreedAt;
    if (!insurerReady) {
      throw new BadRequestException(
        'Pentru flux daună (plătitor asigurător) este necesar Accept plată (sau acordul asigurătorului) înainte de intrarea în reparație (status În lucru).',
      );
    }
  } else if (!sc.damageInsurerAgreedAt) {
    throw new BadRequestException(
      'Pentru flux daună (plătitor client) confirmă plătitorul înainte de intrarea în reparație (status În lucru).',
    );
  }

  const mobility = await prisma.mobilityAssignment.findFirst({
    where: {
      tenantId,
      serviceCaseId: sc.id,
      status: { in: ['reserved', 'active', 'returned'] },
    },
    select: { id: true },
  });
  if (!mobility) {
    throw new BadRequestException(
      'Pentru flux daună este obligatorie mașina la schimb (rezervată, activă sau returnată) înainte de reparație (status În lucru).',
    );
  }
}

/** Gate recepție: vehicul imobil trebuie să aibă asistență rutieră înainte de In service. */
export async function assertImmovableRoadsideForReception(
  prisma: PrismaLike,
  tenantId: string,
  serviceCaseId: string,
  vehicleMovable: VehicleMovableState | null | undefined,
): Promise<void> {
  if (vehicleMovable !== VehicleMovableState.immovable) return;

  const roadside = await prisma.roadsideIntervention.findFirst({
    where: {
      tenantId,
      serviceCaseId,
      status: {
        in: [
          RoadsideInterventionStatus.requested,
          RoadsideInterventionStatus.dispatched,
          RoadsideInterventionStatus.on_site,
          RoadsideInterventionStatus.completed,
        ],
      },
    },
    select: { id: true },
  });
  if (!roadside) {
    throw new BadRequestException(
      'Vehicul imobil: este obligatorie o intervenție asistență rutieră (cel puțin solicitată) înainte de recepție (In service).',
    );
  }
}
