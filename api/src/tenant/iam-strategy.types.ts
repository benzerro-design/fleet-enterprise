export type IamNodeStatus = 'live' | 'planificat' | 'viitor';

export type IamNodeTone =
  | 'platform'
  | 'tenant'
  | 'client'
  | 'driver'
  | 'partner'
  | 'finance'
  | 'tech'
  | 'logistics'
  | 'full'
  | 'neutral';

export type IamStrategyNode = {
  id: string;
  levelLabel: string;
  title: string;
  subtitle?: string;
  examples?: string;
  badge?: string;
  status?: IamNodeStatus;
  tone?: IamNodeTone;
  profileCode?: string;
  branchStyle?: 'solid' | 'dashed';
  children?: IamStrategyNode[];
};

export type IamStrategyPayload = {
  version: 1;
  nodes: IamStrategyNode[];
  updatedAt?: string;
};

export const IAM_STRATEGY_MAX_NODES = 120;
export const IAM_STRATEGY_MAX_DEPTH = 8;
