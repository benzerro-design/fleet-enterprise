import { BadRequestException } from '@nestjs/common';
import { ServiceCaseWorkflowType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/** Programare vulcanizare / anvelope — nu depozit (hotel). */
export const TIRE_SCHEDULING_SERVICE_CODE = 'tire_service';

type ServiceCaseServiceTypeContext = {
  workflowType: ServiceCaseWorkflowType;
  serviceTypeId?: string | null;
  serviceType?: { code: string } | null;
  sourceTicket?: {
    serviceTypeId?: string | null;
    serviceType?: { code: string } | null;
  } | null;
};

export function resolveServiceCaseServiceTypeCodeSync(
  serviceCase: ServiceCaseServiceTypeContext,
): string | null {
  if (serviceCase.serviceType?.code?.trim()) {
    return serviceCase.serviceType.code.trim();
  }
  if (serviceCase.sourceTicket?.serviceType?.code?.trim()) {
    return serviceCase.sourceTicket.serviceType.code.trim();
  }
  if (serviceCase.workflowType === ServiceCaseWorkflowType.tires) {
    return TIRE_SCHEDULING_SERVICE_CODE;
  }
  return null;
}

export async function resolveServiceCaseServiceTypeCode(
  prisma: Pick<PrismaService, 'tenantServiceType'>,
  tenantId: string,
  serviceCase: ServiceCaseServiceTypeContext,
): Promise<string | null> {
  const sync = resolveServiceCaseServiceTypeCodeSync(serviceCase);
  if (sync) return sync;

  if (serviceCase.serviceTypeId) {
    const st = await prisma.tenantServiceType.findFirst({
      where: { id: serviceCase.serviceTypeId, tenantId, active: true },
      select: { code: true },
    });
    if (st?.code?.trim()) return st.code.trim();
  }

  const ticketTypeId = serviceCase.sourceTicket?.serviceTypeId;
  if (ticketTypeId) {
    const st = await prisma.tenantServiceType.findFirst({
      where: { id: ticketTypeId, tenantId, active: true },
      select: { code: true },
    });
    if (st?.code?.trim()) return st.code.trim();
  }

  return null;
}

export async function assertSupplierOffersServiceType(
  prisma: Pick<PrismaService, 'supplierService'>,
  tenantId: string,
  supplierId: string,
  serviceTypeCode: string,
): Promise<void> {
  const code = serviceTypeCode.trim();
  if (!code) return;

  const hit = await prisma.supplierService.findFirst({
    where: {
      tenantId,
      supplierId,
      serviceType: { code, active: true },
    },
    select: { id: true },
  });
  if (!hit) {
    throw new BadRequestException('Furnizorul selectat nu oferă acest tip de serviciu.');
  }
}
