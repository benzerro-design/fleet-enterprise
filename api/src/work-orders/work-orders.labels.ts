import { ServiceCaseStage } from '@prisma/client';

export function workOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Ciornă',
    sent: 'Trimisă',
    in_progress: 'În lucru',
    waiting_parts: 'Așteaptă piese',
    done: 'Finalizată',
    cancelled: 'Anulată',
  };
  return map[status] ?? status;
}

export function serviceCaseStageLabel(stage: string): string {
  const map: Record<ServiceCaseStage, string> = {
    intake: 'Intake',
    scheduled: 'Programare',
    work_order: 'Comandă service',
    quote: 'Deviz',
    approval: 'Aprobare deviz',
    cost: 'Cost',
    invoiced: 'Facturat',
    closed: 'Închis',
  };
  return map[stage as ServiceCaseStage] ?? stage;
}

export function workflowTypeLabel(type: string): string {
  const map: Record<string, string> = {
    repair: 'Reparație',
    damage: 'Daună',
    itp: 'ITP',
    tires: 'Anvelope',
    insurance_rca: 'RCA',
    insurance_casco: 'CASCO',
  };
  return map[type] ?? type;
}
