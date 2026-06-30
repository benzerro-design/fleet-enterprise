import type { BotFindingSeverity, BotSessionStatus } from '@prisma/client';

export const BOT_DEMO_TENANT_SLUG = 'demo';
export const BOT_REF_PREFIX = 'BOT-';

export type BotDivision = 'alpha' | 'beta' | 'tenant_wide';
export type BotMode = 'populate' | 'fault_test';
export type BotOperation = 'create' | 'edit' | 'delete';

export type BotModuleOperations = {
  create?: number;
  edit?: number;
  delete?: number;
  options?: Record<string, unknown>;
};

export type BotRunConfig = {
  scenarioId: string;
  division: BotDivision;
  seed: number;
  mode: BotMode;
  concurrentUsers: number;
  modules: Record<string, BotModuleOperations>;
  faults?: string[];
};

export type BotFindingLink = {
  label: string;
  href: string;
  apiRef?: string;
};

export type BotEntityRef = {
  type: string;
  id: string;
  label?: string;
};

export type BotModuleDefinition = {
  id: string;
  label: string;
  domain: 'operations' | 'crm' | 'admin';
  description: string;
  operations: BotOperation[];
  optionFields?: Array<{
    key: string;
    label: string;
    type: 'boolean' | 'select';
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

export type BotRunContext = {
  tenantId: string;
  tenantSlug: string;
  actorUserId: string;
  sessionId: string;
  division: BotDivision;
  seed: number;
  mode: BotMode;
  concurrentUsers: number;
};

export type BotStepResult = {
  created: number;
  edited: number;
  deleted: number;
  failed: number;
  skipped: number;
  meta?: Record<string, unknown>;
};

export type BotFindingInput = {
  moduleId: string;
  severity: BotFindingSeverity;
  message: string;
  links?: BotFindingLink[];
  remediation?: string;
  entityRefs?: BotEntityRef[];
  faultId?: string;
  expected?: boolean;
};

export type BotSessionRecord = {
  id: string;
  scenarioId: string;
  division: string;
  seed: number;
  mode: string;
  status: BotSessionStatus;
  concurrentUsers: number;
  impersonatedAs: string | null;
  summary: string | null;
  config: BotRunConfig;
  startedAt: string;
  finishedAt: string | null;
  actorEmail?: string;
  steps: BotStepRecord[];
  findings: BotFindingRecord[];
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
  meta?: Record<string, unknown> | null;
};

export type BotFindingRecord = {
  id: string;
  moduleId: string;
  severity: BotFindingSeverity;
  faultId: string | null;
  expected: boolean;
  message: string;
  links: BotFindingLink[];
  remediation: string | null;
  entityRefs: BotEntityRef[] | null;
};
