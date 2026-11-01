import Link from "next/link";

/** SETUP-017/018/020 — CTA pe listă către motorul din Setup → Importuri. */
export function ListImportCsvLink({
  entity,
  label = "Import CSV",
}: {
  entity: "vehicles" | "drivers" | "costs" | "documents" | "suppliers";
  label?: string;
}) {
  return (
    <Link
      href={`/fleet/setup/imports?entity=${entity}`}
      className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
    >
      {label}
    </Link>
  );
}
