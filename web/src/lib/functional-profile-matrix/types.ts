export type FunctionalCapability =
  | "quote.edit"
  | "quote.approve"
  | "quote.postCost"
  | "scheduler.write"
  | "fleet.write";

export type FunctionalProfileKey = "F" | "T" | "G" | "full";

export type FunctionalProfileMatrixEffective = Record<
  FunctionalProfileKey,
  Record<FunctionalCapability, boolean>
>;

export type FunctionalProfileMatrixOverride = Partial<
  Record<FunctionalProfileKey, Partial<Record<FunctionalCapability, boolean>>>
>;

export type FunctionalProfileMatrixResponse = {
  version: 1;
  defaults: FunctionalProfileMatrixEffective;
  effective: FunctionalProfileMatrixEffective;
  override: FunctionalProfileMatrixOverride | null;
  isDefault: boolean;
  updatedAt: string | null;
};
