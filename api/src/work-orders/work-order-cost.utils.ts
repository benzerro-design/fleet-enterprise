import { ServiceCaseWorkflowType } from '@prisma/client';

const WORKFLOW_COST_CATEGORY: Record<ServiceCaseWorkflowType, string> = {
  repair: 'Reparații',
  damage: 'Reparații',
  itp: 'ITP',
  tires: 'Anvelope',
  insurance_rca: 'RCA',
  insurance_casco: 'CASCO',
};

export function costCategoryForWorkflow(workflowType: ServiceCaseWorkflowType): string {
  return WORKFLOW_COST_CATEGORY[workflowType] ?? 'Reparații';
}
