/** Preferință locală — Slice A: tab-uri Curente/Istoric pe PROGRAMĂRI (manager/admin). Default OFF. */
export const APPOINTMENT_PROPOSAL_HISTORY_TABS_KEY = "fleet-appt-proposal-history-tabs";

export function readAppointmentProposalHistoryTabs(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(APPOINTMENT_PROPOSAL_HISTORY_TABS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAppointmentProposalHistoryTabs(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) localStorage.setItem(APPOINTMENT_PROPOSAL_HISTORY_TABS_KEY, "1");
    else localStorage.removeItem(APPOINTMENT_PROPOSAL_HISTORY_TABS_KEY);
    window.dispatchEvent(new Event("fleet-appt-proposal-history-tabs"));
  } catch {
    /* ignore */
  }
}
