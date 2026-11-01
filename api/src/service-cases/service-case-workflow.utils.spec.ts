import { ServiceCaseWorkflowType, ServiceOrderType } from '@prisma/client';
import {
  isTireServiceTypeCode,
  isTireStorageTypeCode,
  resolveServiceCaseWorkflow,
  resolveServiceOrderType,
} from './service-case-workflow.utils';

describe('service-case-workflow tire codes', () => {
  it('maps only tire_service to tires / R', () => {
    expect(isTireServiceTypeCode('tire_service')).toBe(true);
    expect(isTireServiceTypeCode('tire_storage')).toBe(false);
    expect(isTireStorageTypeCode('tire_storage')).toBe(true);

    expect(
      resolveServiceCaseWorkflow({ serviceTypeCode: 'tire_service' }),
    ).toBe(ServiceCaseWorkflowType.tires);
    expect(
      resolveServiceCaseWorkflow({ serviceTypeCode: 'tire_storage' }),
    ).toBe(ServiceCaseWorkflowType.repair);

    expect(
      resolveServiceOrderType({
        workflowType: ServiceCaseWorkflowType.repair,
        serviceTypeCode: 'tire_storage',
      }),
    ).toBe(ServiceOrderType.M);
    expect(
      resolveServiceOrderType({
        workflowType: ServiceCaseWorkflowType.tires,
        serviceTypeCode: 'tire_service',
      }),
    ).toBe(ServiceOrderType.R);
  });
});
