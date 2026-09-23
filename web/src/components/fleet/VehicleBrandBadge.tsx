type Props = {
  brand?: string | null;
  model?: string | null;
};

const KNOWN = ["bmw", "ford", "dacia", "vw", "volkswagen", "audi", "mercedes", "renault", "toyota", "skoda", "opel", "peugeot"];

function tone(brand: string): string {
  const key = brand.toLowerCase();
  if (key.includes("bmw")) return "bg-sky-900 text-sky-100";
  if (key.includes("ford")) return "bg-blue-900 text-blue-100";
  if (key.includes("dacia")) return "bg-emerald-900 text-emerald-100";
  if (key.includes("mercedes")) return "bg-zinc-700 text-zinc-100";
  if (key.includes("audi")) return "bg-red-950 text-red-100";
  return "bg-zinc-800 text-zinc-200";
}

export function VehicleBrandBadge({ brand, model }: Props) {
  const label = (brand ?? "").trim();
  const known = KNOWN.some((k) => label.toLowerCase().includes(k));
  const mark = (label || "?").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold ${tone(label)}`}
        title={known ? label : "Marcaj după nume — fără fotografie de model"}
      >
        {mark}
      </span>
      <span className="text-sm text-zinc-200">
        {label || "—"}
        {model ? <span className="text-zinc-400"> {model}</span> : null}
      </span>
    </div>
  );
}
