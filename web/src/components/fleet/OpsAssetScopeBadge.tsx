/** Badge / etichetă: cost sau mentenanță pe autovehicul vs pe echipare. */
export function OpsAssetScopeBadge({
  equipmentLabel,
  className = "",
}: {
  equipmentLabel?: string | null;
  className?: string;
}) {
  const onEquipment = Boolean(equipmentLabel?.trim());
  return (
    <span
      className={
        onEquipment
          ? `inline-flex max-w-full items-center gap-1 rounded border border-sky-800/60 bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-200 ${className}`
          : `inline-flex items-center rounded border border-zinc-700/80 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 ${className}`
      }
      title={onEquipment ? `Echipare: ${equipmentLabel}` : "Atribuit autovehiculului"}
    >
      {onEquipment ? (
        <>
          <span className="shrink-0">Echipare</span>
          <span className="truncate font-normal normal-case tracking-normal text-sky-100/90">
            · {equipmentLabel}
          </span>
        </>
      ) : (
        "Autovehicul"
      )}
    </span>
  );
}
