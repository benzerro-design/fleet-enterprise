export type IamNodeStatus = "live" | "planificat" | "viitor";

export type IamNodeTone =
  | "platform"
  | "tenant"
  | "client"
  | "driver"
  | "partner"
  | "finance"
  | "tech"
  | "logistics"
  | "full"
  | "neutral";

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
  branchStyle?: "solid" | "dashed";
  children?: IamStrategyNode[];
};

export type IamStrategyResponse = {
  version: 1;
  nodes: IamStrategyNode[];
  isDefault: boolean;
  updatedAt: string | null;
};

export function newIamNode(partial?: Partial<IamStrategyNode>): IamStrategyNode {
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `node-${Date.now()}`,
    levelLabel: "L?",
    title: "Nod nou",
    subtitle: "",
    status: "planificat",
    tone: "neutral",
    children: [],
    ...partial,
  };
}
