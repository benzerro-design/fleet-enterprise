export type ComplianceStatus = "valid" | "expired" | "missing";

export type VehicleFormBriefComplianceItem = {
  status: ComplianceStatus;
  expiresOn: string | null;
};

export type VehicleFormBriefRevision = {
  title: string;
  performedOn: string;
  odometerKm: number | null;
};

export type VehicleFormBriefEntry = {
  id: string;
  cells: string[];
  detail: Record<string, string>;
};

export type VehicleFormBriefModule = {
  total: number;
  entries: VehicleFormBriefEntry[];
};

export type VehicleFormBriefPayload = {
  vehicle: {
    id: string;
    registrationNumber: string;
    clientId: string;
    clientLegalName: string | null;
    odometerKm: number;
    itpExpiresOn: string | null;
    brand: string | null;
    model: string | null;
  };
  compliance: {
    rca: VehicleFormBriefComplianceItem;
    casco: VehicleFormBriefComplianceItem;
    vignette: VehicleFormBriefComplianceItem;
  };
  lastPeriodicRevision: VehicleFormBriefRevision | null;
  modules: {
    maintenance: VehicleFormBriefModule;
    costs: VehicleFormBriefModule;
    documents: VehicleFormBriefModule;
    reminders: VehicleFormBriefModule;
    trips: VehicleFormBriefModule;
  };
};
