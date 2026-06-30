export const botBrowserBase = "/api/bot";

export type BotOperation = "create" | "edit" | "delete";

export type BotModuleOperations = {
  create?: number;
  edit?: number;
  delete?: number;
  options?: Record<string, unknown>;
};

export type BotModuleDefinition = {
  id: string;
  label: string;
  domain: string;
  description: string;
  operations: BotOperation[];
  optionFields?: Array<{
    key: string;
    label: string;
    type: "boolean" | "select";
    options?: Array<{ value: string; label: string }>;
    defaultValue?: boolean | string;
    hint?: string;
  }>;
  maxPerOperation: number;
  dependencies?: string[];
  implemented: boolean;
  supportsMultiUser: boolean;
  supportsMobile: boolean;
};

export type BotScenarioPreset = {
  id: string;
  label: string;
  description: string;
  division: BotDivision;
  modules: Record<string, BotModuleOperations>;
};

export type BotDivision = "alpha" | "beta" | "tenant_wide";
export type BotMode = "populate" | "fault_test";

export type BotFaultDefinition = {
  id: string;
  label: string;
  description: string;
  moduleId: string;
};

export type BotCatalogPayload = {
  modules: BotModuleDefinition[];
  scenarios: BotScenarioPreset[];
  faults: BotFaultDefinition[];
  constraints: {
    tenantSlug: string;
    minRole: string;
    multiUserNote: string;
    mobileNote: string;
  };
  enabled: boolean;
  enabledHint: string | null;
};

export type BotFindingLink = {
  label: string;
  href: string;
  apiRef?: string;
};

export type BotFindingRecord = {
  id: string;
  moduleId: string;
  severity: "error" | "warning" | "info" | "expected";
  faultId: string | null;
  expected: boolean;
  message: string;
  links: BotFindingLink[];
  remediation: string | null;
  entityRefs: Array<{ type: string; id: string; label?: string }> | null;
};

export type BotStepRecord = {
  id: string;
  moduleId: string;
  requested: BotModuleOperations;
  created: number;
  edited: number;
  deleted: number;
  failed: number;
  skipped: number;
  durationMs: number;
};

export type BotSessionRecord = {
  id: string;
  scenarioId: string;
  division: string;
  seed: number;
  mode: string;
  status: "running" | "success" | "partial" | "failed";
  concurrentUsers: number;
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
  actorEmail?: string;
  steps: BotStepRecord[];
  findings: BotFindingRecord[];
};

export type StartBotSessionInput = {
  scenarioId?: string;
  division: BotDivision;
  seed?: number;
  mode?: BotMode;
  concurrentUsers?: number;
  modules: Record<string, BotModuleOperations>;
  faults?: string[];
};

export function fleetJsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export function botSeverityClass(severity: BotFindingRecord["severity"]): string {
  switch (severity) {
    case "error":
      return "text-rose-400";
    case "warning":
      return "text-amber-400";
    case "expected":
      return "text-sky-400";
    default:
      return "text-zinc-400";
  }
}

export function botStatusClass(status: BotSessionRecord["status"]): string {
  switch (status) {
    case "success":
      return "text-emerald-400";
    case "partial":
      return "text-amber-400";
    case "failed":
      return "text-rose-400";
    default:
      return "text-zinc-400";
  }
}
