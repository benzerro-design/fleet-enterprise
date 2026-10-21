import Link from "next/link";
import { redirect } from "next/navigation";
import { UserStrategyEditor } from "@/components/fleet/admin/UserStrategyEditor";
import { UserStrategyHub } from "@/components/fleet/admin/UserStrategyHub";
import { UserStrategyRights } from "@/components/fleet/admin/UserStrategyRights";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";
import type { FunctionalProfileMatrixResponse } from "@/lib/functional-profile-matrix/types";
import type { IamStrategyResponse } from "@/lib/iam-strategy/types";
import { parseUserStrategyTab } from "@/lib/user-strategy-tabs";

async function loadStrategy(): Promise<IamStrategyResponse | null> {
  try {
    const res = await apiServerFetch("/tenant/iam-strategy");
    if (!res?.ok) return null;
    return (await res.json()) as IamStrategyResponse;
  } catch {
    return null;
  }
}

async function loadFunctionalProfileMatrix(): Promise<FunctionalProfileMatrixResponse | null> {
  try {
    const res = await apiServerFetch("/tenant/functional-profile-matrix");
    if (!res?.ok) return null;
    return (await res.json()) as FunctionalProfileMatrixResponse;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<{ tab?: string }> };

export default async function UserStrategyPage({ searchParams }: PageProps) {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const sp = (await searchParams) ?? {};
  const tab = parseUserStrategyTab(sp.tab);
  const initial = tab === "map" ? await loadStrategy() : null;
  const initialMatrix = tab === "rights" ? await loadFunctionalProfileMatrix() : null;

  return (
    <FleetPageMain fill className="min-h-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Administrare</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Strategie useri</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Hartă ierarhică L** / L* / L1 / L0 / R și drepturile F/T/G (IAM-003). Canonic:{" "}
            <code className="text-zinc-300">docs/identity-access-model.md</code> §3.5.
          </p>
        </div>
        <Link
          href="/fleet/members"
          className="inline-flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Membri & invitații
        </Link>
      </div>

      <UserStrategyHub active={tab}>
        {tab === "rights" ? (
          <div className={`min-h-0 flex-1 overflow-y-auto ${fleetScrollPaneClass}`}>
            <UserStrategyRights initial={initialMatrix} />
          </div>
        ) : !initial ? (
          <p className="text-amber-400">
            Nu am putut încărca harta. Verifică API-ul și migrarea{" "}
            <code className="font-mono text-zinc-400">20260703120000_tenant_iam_strategy_map</code>.
          </p>
        ) : (
          <UserStrategyEditor initial={initial} />
        )}
      </UserStrategyHub>
    </FleetPageMain>
  );
}
