export const USER_STRATEGY_TABS = [
  { id: "map", label: "Hartă ierarhică", href: "/fleet/user-strategy" },
  { id: "rights", label: "Drepturi F/T/G", href: "/fleet/user-strategy?tab=rights" },
] as const;

export type UserStrategyTabId = (typeof USER_STRATEGY_TABS)[number]["id"];

export function parseUserStrategyTab(raw?: string | null): UserStrategyTabId {
  if (raw === "rights") return "rights";
  return "map";
}
