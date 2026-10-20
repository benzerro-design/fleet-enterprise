import type { ServiceCaseRecord } from "@/lib/service-cases-api";

export const TIRE_SCHEDULING_SERVICE_CODE = "tire_service";

export function resolveSchedulingServiceTypeCode(
  serviceCase: ServiceCaseRecord | null | undefined,
  ticketServiceTypeCode?: string | null,
): string | undefined {
  if (serviceCase?.serviceTypeCode?.trim()) {
    return serviceCase.serviceTypeCode.trim();
  }
  if (ticketServiceTypeCode?.trim()) {
    return ticketServiceTypeCode.trim();
  }
  if (serviceCase?.workflowType === "tires") {
    return TIRE_SCHEDULING_SERVICE_CODE;
  }
  return undefined;
}
