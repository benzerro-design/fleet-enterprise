export const driversBrowserBase = "/api/drivers";

export type DriverStatus = "active" | "inactive" | "suspended";

export type DriverRecord = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  fullName: string;
  employeeCode: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  licenseCategories: string | null;
  licenseExpiresOn: string | null;
  status: DriverStatus;
  notes: string | null;
  activeVehicleIds: string[];
  activeVehicleRegistrations: string[];
  createdAt: string;
  updatedAt: string;
};

export type DriverAssignmentRecord = {
  id: string;
  driverId: string;
  vehicleId: string;
  registrationNumber: string;
  assignedAt: string;
  unassignedAt: string | null;
  assignedByUserId: string | null;
  assignedByEmail: string | null;
  notes: string | null;
};

export type DriverListPayload = {
  items: DriverRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type DriverDetailPayload = {
  driver: DriverRecord;
  assignments: DriverAssignmentRecord[];
};

export function fleetJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export function driverStatusLabel(status: DriverStatus): string {
  switch (status) {
    case "active":
      return "Activ";
    case "inactive":
      return "Inactiv";
    case "suspended":
      return "Suspendat";
    default:
      return status;
  }
}
