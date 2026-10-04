import { SheetListGrid, type SheetCol } from "@/components/fleet/SheetListGrid";
import { formatRonFromCents } from "@/lib/money";
import type { ClientSubscriptionRow } from "@/lib/clients-api";
import {
  billingCycleLabel,
  planAssignmentStatusClass,
  planAssignmentStatusLabel,
} from "@/lib/pricing-plan-types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

type Col = "plan" | "code" | "cycle" | "price" | "from" | "to" | "status";

const COLUMNS: SheetCol<Col>[] = [
  { key: "plan", label: "Plan", defaultVisible: true, canHide: false, width: "28%" },
  { key: "code", label: "Cod", defaultVisible: true, canHide: true, width: "12%" },
  { key: "cycle", label: "Ciclu", defaultVisible: true, canHide: true, width: "12%" },
  { key: "price", label: "Preț", defaultVisible: true, canHide: true, width: "14%", align: "right" },
  { key: "from", label: "De la", defaultVisible: true, canHide: true, width: "12%" },
  { key: "to", label: "Până la", defaultVisible: true, canHide: true, width: "12%" },
  { key: "status", label: "Status", defaultVisible: true, canHide: true, width: "12%" },
];

type Props = {
  subscriptions: ClientSubscriptionRow[];
};

export function ClientSubscriptionTab({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 px-6 py-10 text-center">
        <p className="text-sm font-medium text-zinc-300">Niciun plan tarifar aplicat</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Planurile tarifare ale clientului vor apărea aici după configurare din{" "}
          <span className="text-zinc-400">Setări → Clienți</span> (superadmin).
        </p>
      </div>
    );
  }

  return (
    <SheetListGrid
      storageKey="fleet-client-subscription-grid-v1"
      pickerTitle="Coloane abonament"
      columns={COLUMNS}
      rows={subscriptions}
      rowKey={(row) => row.assignmentId}
      searchPlaceholder="Plan, cod…"
      searchText={(row) => `${row.plan.name} ${row.plan.code} ${row.notes ?? ""}`}
      statusOptions={[
        { value: "active", label: "Activ" },
        { value: "scheduled", label: "Programat" },
        { value: "expired", label: "Expirat" },
        { value: "cancelled", label: "Anulat" },
      ]}
      rowStatus={(row) => row.status}
      empty={<p>Niciun plan pentru filtrele curente.</p>}
      renderCell={(key, row) => {
        if (key === "plan") {
          return (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-zinc-100">{row.plan.name}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {row.plan.description?.trim() || row.notes?.trim() || "—"}
              </p>
            </div>
          );
        }
        if (key === "code") return <span className="font-mono text-xs text-zinc-400">{row.plan.code}</span>;
        if (key === "cycle") return <span className="text-zinc-300">{billingCycleLabel(row.plan.billingCycle)}</span>;
        if (key === "price") {
          return (
            <span className="font-mono tabular-nums text-zinc-200">
              {formatRonFromCents(row.plan.priceCents)} {row.plan.currency}
            </span>
          );
        }
        if (key === "from") return <span className="text-zinc-400">{formatDate(row.effectiveFrom)}</span>;
        if (key === "to") return <span className="text-zinc-400">{formatDate(row.effectiveTo)}</span>;
        return (
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${planAssignmentStatusClass(row.status)}`}
          >
            {planAssignmentStatusLabel(row.status)}
          </span>
        );
      }}
    />
  );
}
