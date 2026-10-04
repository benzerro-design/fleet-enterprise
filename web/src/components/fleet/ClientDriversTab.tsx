import Link from "next/link";
import { IconEye, IconPencil, listGridIconBtnClass } from "@/components/fleet/list-grid-icons";
import { SheetListGrid, type SheetCol } from "@/components/fleet/SheetListGrid";
import { driverStatusLabel, type DriverRecord, type DriverStatus } from "@/lib/drivers-api";

type Col = "name" | "status" | "vehicles" | "phone" | "license" | "actions";

const COLUMNS: SheetCol<Col>[] = [
  { key: "name", label: "Șofer", defaultVisible: true, canHide: false, width: "24%" },
  { key: "status", label: "Status", defaultVisible: true, canHide: true, width: "12%" },
  { key: "vehicles", label: "Vehicule active", defaultVisible: true, canHide: true, width: "22%" },
  { key: "phone", label: "Telefon", defaultVisible: true, canHide: true, width: "14%" },
  { key: "license", label: "Permis", defaultVisible: true, canHide: true, width: "14%" },
  { key: "actions", label: "Acțiuni", defaultVisible: true, canHide: false, width: "7.5rem", align: "right" },
];

function statusClass(status: DriverStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "suspended":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
  }
}

function licenseLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO");
}

type Props = {
  clientCode: string;
  drivers: DriverRecord[];
  canWrite: boolean;
};

export function ClientDriversTab({ clientCode, drivers, canWrite }: Props) {
  return (
    <SheetListGrid
      storageKey="fleet-client-drivers-grid-v1"
      pickerTitle="Coloane șoferi"
      columns={COLUMNS}
      rows={drivers}
      rowKey={(d) => d.id}
      searchPlaceholder="Nume, telefon, nr. auto…"
      searchText={(d) =>
        [d.fullName, d.phone, d.email, d.employeeCode, ...d.activeVehicleRegistrations].filter(Boolean).join(" ")
      }
      statusOptions={[
        { value: "active", label: "Activ" },
        { value: "inactive", label: "Inactiv" },
        { value: "suspended", label: "Suspendat" },
      ]}
      rowStatus={(d) => d.status}
      toolbarEnd={
        canWrite ? (
          <Link
            href={`/fleet/drivers/new?client=${encodeURIComponent(clientCode)}`}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Șofer nou
          </Link>
        ) : null
      }
      empty={
        <p>
          Niciun șofer pentru filtrele curente.
          {canWrite ? (
            <>
              {" "}
              <Link
                href={`/fleet/drivers/new?client=${encodeURIComponent(clientCode)}`}
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                Adaugă șofer
              </Link>
              .
            </>
          ) : null}
        </p>
      }
      renderCell={(key, d) => {
        if (key === "name") {
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              {d.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-zinc-700/60" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-[10px] font-medium uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-700/60">
                  {d.fullName.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-zinc-100">{d.fullName}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{d.email?.trim() || d.employeeCode || "Fără email"}</p>
              </div>
            </div>
          );
        }
        if (key === "status") {
          return (
            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass(d.status)}`}>
              {driverStatusLabel(d.status)}
            </span>
          );
        }
        if (key === "vehicles") {
          return (
            <span className="block truncate font-mono text-[12px] text-zinc-300">
              {d.activeVehicleRegistrations.length > 0 ? d.activeVehicleRegistrations.join(", ") : "—"}
            </span>
          );
        }
        if (key === "phone") return <span className="text-zinc-300">{d.phone ?? "—"}</span>;
        if (key === "license") {
          return <span className="font-mono tabular-nums text-zinc-300">{licenseLabel(d.licenseExpiresOn)}</span>;
        }
        return (
          <div className="inline-flex items-center justify-end gap-1">
            <Link
              href={`/fleet/drivers/${d.id}`}
              className={`${listGridIconBtnClass} text-emerald-400/90 hover:text-emerald-300`}
              title="Vezi detaliu"
              aria-label={`Vezi ${d.fullName}`}
            >
              <IconEye className="h-3.5 w-3.5" />
            </Link>
            {canWrite ? (
              <Link
                href={`/fleet/drivers/${d.id}/edit`}
                className={listGridIconBtnClass}
                title="Editare"
                aria-label={`Editează ${d.fullName}`}
              >
                <IconPencil className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        );
      }}
    />
  );
}
