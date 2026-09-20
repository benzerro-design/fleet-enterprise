export type FleetDashboardKpiLinks = {
  vehiclesActive: string;
  itpWithin30Days: string;
  itpWithin60Days: string;
  documentsExpired: string;
  documentsExpiringSoon: string;
  remindersNeedingAction: string;
  remindersOverdue: string;
  costsCurrentMonth: string;
  tripsCurrentMonth: string;
};

export type FleetDashboardItpRow = {
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  itpExpiresOn: string;
  daysUntilExpiry: number;
};

export type FleetDashboardReminderRow = {
  id: string;
  title: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  status: string;
  dueOn: string | null;
};

export type FleetDashboardSnapshot = {
  generatedAt: string;
  /** Luna selectată pentru costuri/curse (UTC). */
  currentMonth: { from: string; to: string };
  /** Offset față de luna calendaristică curentă: 0 = acum, -1 = luna trecută. */
  monthOffset: number;
  kpis: {
    vehiclesActive: number;
    vehiclesTotal: number;
    itpWithin30Days: number;
    itpWithin60Days: number;
    documentsExpired: number;
    documentsExpiringSoon: number;
    remindersNeedingAction: number;
    remindersOverdue: number;
    remindersActive: number;
    costsCurrentMonthCents: number;
    tripsCurrentMonth: number;
    /** Luna imediat anterioară celei selectate — pentru trend. */
    costsPriorMonthCents: number;
    tripsPriorMonth: number;
  };
  links: FleetDashboardKpiLinks;
  itpSoon: FleetDashboardItpRow[];
  remindersDue: FleetDashboardReminderRow[];
};
