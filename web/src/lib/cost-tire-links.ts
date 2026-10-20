export function isTireCostCategory(category: string): boolean {
  return category.trim().toLowerCase() === "anvelope";
}

export function costHasTireLink(row: {
  tireAssetId?: string | null;
  tireSetId?: string | null;
  tireStorageStayId?: string | null;
  hasTireCostLink?: boolean;
}): boolean {
  if (row.hasTireCostLink) return true;
  return Boolean(row.tireAssetId || row.tireSetId || row.tireStorageStayId);
}
