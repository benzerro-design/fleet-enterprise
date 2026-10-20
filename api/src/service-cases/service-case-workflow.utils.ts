import { CrmTicketType, ServiceCaseWorkflowType, ServiceOrderType } from '@prisma/client';

export const TIRE_SERVICE_TYPE_CODES = new Set(['tire_service', 'tire_storage']);

export function isTireServiceTypeCode(code: string | null | undefined): boolean {
  return !!code && TIRE_SERVICE_TYPE_CODES.has(code);
}

export function workflowTypeForTicketType(ticketType: CrmTicketType): ServiceCaseWorkflowType {
  switch (ticketType) {
    case CrmTicketType.damage:
      return ServiceCaseWorkflowType.damage;
    case CrmTicketType.itp:
      return ServiceCaseWorkflowType.itp;
    case CrmTicketType.maintenance:
    case CrmTicketType.technical:
      return ServiceCaseWorkflowType.repair;
    case CrmTicketType.document:
      return ServiceCaseWorkflowType.insurance_rca;
    default:
      return ServiceCaseWorkflowType.repair;
  }
}

export function resolveServiceCaseWorkflow(input: {
  ticketType?: CrmTicketType | null;
  serviceTypeCode?: string | null;
  explicitWorkflow?: ServiceCaseWorkflowType | string | null;
}): ServiceCaseWorkflowType {
  if (
    input.explicitWorkflow === ServiceCaseWorkflowType.itp ||
    input.explicitWorkflow === 'itp'
  ) {
    return ServiceCaseWorkflowType.itp;
  }
  if (isTireServiceTypeCode(input.serviceTypeCode)) {
    return ServiceCaseWorkflowType.tires;
  }
  if (input.ticketType) {
    return workflowTypeForTicketType(input.ticketType);
  }
  return ServiceCaseWorkflowType.repair;
}

export function resolveServiceOrderType(input: {
  workflowType: ServiceCaseWorkflowType;
  serviceTypeCode?: string | null;
}): ServiceOrderType {
  if (input.workflowType === ServiceCaseWorkflowType.damage) {
    return ServiceOrderType.D;
  }
  if (
    input.workflowType === ServiceCaseWorkflowType.tires ||
    isTireServiceTypeCode(input.serviceTypeCode)
  ) {
    return ServiceOrderType.R;
  }
  return ServiceOrderType.M;
}
