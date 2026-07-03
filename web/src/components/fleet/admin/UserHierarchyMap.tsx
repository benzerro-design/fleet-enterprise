/**
 * Hartă ierarhică IAM — sursă canonică: docs/identity-access-model.md §3.5
 * Afișată în Administrare → Membri & useri client (panou dreapta).
 */
export function UserHierarchyMap() {
  return (
    <aside
      className="sticky top-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm shadow-lg shadow-black/20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
      aria-label="Hartă ierarhie useri și roluri"
    >
      <div className="mb-4 border-b border-zinc-800 pb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">Hartă IAM</p>
        <h2 className="mt-1 text-base font-semibold text-zinc-100">Strategie useri & nivele L</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Referință vizuală — vezi <code className="text-zinc-400">identity-access-model.md</code>
        </p>
      </div>

      {/* L** */}
      <div className="relative flex flex-col items-center">
        <LevelBox
          level="L**"
          title="Superadmin platformă"
          subtitle="Owner business & app (doar vendor)"
          tone="platform"
          badge="STRAT 0"
          examples="Cont manual · Neon / GCP"
          status="planificat"
        />

        <Connector />

        {/* L* block */}
        <div className="w-full">
          <LevelBox
            level="L*"
            title="Admin tenant (FlotaX)"
            subtitle="Administrare clienți: Alpha, Beta, Client_1…"
            tone="tenant"
            badge="STRAT 1"
            examples="admin@demo · flotax_admin@flotax"
            status="live"
          />

          <div className="mt-2 ml-3 border-l-2 border-sky-800/60 pl-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-sky-500/90">
              Profile funcționale (aceeași treaptă L*)
            </p>
            <div className="grid gap-1.5">
              <ProfileChip code="F" label="Financiar" hint="Deviz aprobare · cost · factură" tone="finance" />
              <ProfileChip code="T" label="Tehnic" hint="Tichete · service · deviz edit" tone="tech" />
              <ProfileChip code="G" label="Logistică" hint="Programator · curse · șoferi" tone="logistics" />
              <ProfileChip code="full" label="Administrator full" hint="Toate capabilitățile L*" tone="full" emphasized />
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">+ tenant_viewer = L* doar citire</p>
          </div>
        </div>

        <Connector />

        {/* L1 block */}
        <div className="w-full">
          <LevelBox
            level="L1"
            title="Manager / angajat client"
            subtitle="Scoped la organizația contractuală (ex. Alpha SRL)"
            tone="client"
            badge="STRAT 2"
            examples="manager.alpha · client1flotax@flotax"
            status="live"
          />

          <div className="mt-2 ml-3 border-l-2 border-violet-800/60 pl-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-violet-500/90">
              Aceleași profile F · T · G · full
            </p>
            <div className="grid gap-1.5">
              <ProfileChip code="F" label="Financiar client" hint="Aprobă buget deviz" tone="finance" />
              <ProfileChip code="T" label="Tehnic client" hint="Tichete reparații · programări" tone="tech" />
              <ProfileChip code="G" label="Logistică client" hint="Curse · disponibilitate mașini" tone="logistics" />
              <ProfileChip code="full" label="Manager general" hint="Spec CRM / devize pilot" tone="full" emphasized />
            </div>
          </div>
        </div>

        <Connector />

        <LevelBox
          level="L0"
          title="Utilizator mașină / șofer"
          subtitle="Angajat client — vehicul(e) asignate"
          tone="driver"
          badge="STRAT 2"
          examples="sofer.alpha · client1flotaxsofer@flotax"
          status="live"
        />

        <Connector dashed />

        {/* R axis */}
        <div className="w-full rounded-lg border border-dashed border-amber-700/40 bg-amber-950/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs font-bold text-amber-300">Axa R — Parteneri</p>
              <p className="mt-0.5 text-xs text-zinc-400">Nu sunt în ierarhia L a flotei</p>
            </div>
            <span className="shrink-0 rounded bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-400/90">
              viitor
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
            <li>
              <span className="text-amber-400/90">R*</span> admin furnizor (service, piese…)
            </li>
            <li>
              <span className="text-amber-400/90">R1</span> operator — deviz, programare, factură WO
            </li>
            <li>
              <span className="text-amber-400/90">R0</span> vizualizare comenzi alocate
            </li>
          </ul>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4 text-[11px] text-zinc-500">
        <p className="font-medium text-zinc-400">Reguli cheie</p>
        <ul className="list-inside list-disc space-y-1 leading-relaxed">
          <li>
            <strong className="font-medium text-zinc-400">F / T / G</strong> nu sunt nivele L — sunt job-uri pe
            aceeași treaptă.
          </li>
          <li>
            <strong className="font-medium text-zinc-400">T</strong> editează deviz ·{" "}
            <strong className="font-medium text-zinc-400">F</strong> aprobă ·{" "}
            <strong className="font-medium text-zinc-400">G</strong> coordonează mișcarea.
          </li>
          <li>Tenanți diferiți (<code className="text-zinc-400">demo</code> /{" "}
            <code className="text-zinc-400">flotax</code>) = aceeași ierarhie, date izolate.
          </li>
          <li>
            CRM: <span className="text-zinc-400">L1+N</span> = rutare tichet (escaladare), nu tip de user.
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <StatusPill label="live" />
          <StatusPill label="planificat" muted />
        </div>
      </div>
    </aside>
  );
}

function Connector({ dashed }: { dashed?: boolean }) {
  return (
    <div
      className={`my-1 h-5 w-px ${dashed ? "border-l border-dashed border-zinc-700 bg-transparent" : "bg-zinc-700"}`}
      aria-hidden
    />
  );
}

function LevelBox({
  level,
  title,
  subtitle,
  tone,
  badge,
  examples,
  status,
}: {
  level: string;
  title: string;
  subtitle: string;
  tone: "platform" | "tenant" | "client" | "driver";
  badge: string;
  examples: string;
  status: "live" | "planificat";
}) {
  const tones = {
    platform: "border-rose-500/50 bg-rose-950/30 ring-rose-500/20",
    tenant: "border-sky-500/50 bg-sky-950/30 ring-sky-500/20",
    client: "border-violet-500/50 bg-violet-950/30 ring-violet-500/20",
    driver: "border-zinc-600 bg-zinc-900/60 ring-zinc-600/30",
  };
  const levelColors = {
    platform: "text-rose-300",
    tenant: "text-sky-300",
    client: "text-violet-300",
    driver: "text-zinc-300",
  };

  return (
    <div className={`w-full rounded-lg border p-3 ring-1 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`font-mono text-lg font-bold leading-none ${levelColors[tone]}`}>{level}</span>
        <span className="shrink-0 rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-100">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-zinc-400">{subtitle}</p>
      <p className="mt-2 font-mono text-[10px] text-zinc-500">{examples}</p>
      <div className="mt-2">
        <StatusPill label={status} muted={status === "planificat"} />
      </div>
    </div>
  );
}

function ProfileChip({
  code,
  label,
  hint,
  tone,
  emphasized,
}: {
  code: string;
  label: string;
  hint: string;
  tone: "finance" | "tech" | "logistics" | "full";
  emphasized?: boolean;
}) {
  const codeColors = {
    finance: "bg-emerald-950 text-emerald-300 border-emerald-800/60",
    tech: "bg-orange-950 text-orange-300 border-orange-800/60",
    logistics: "bg-cyan-950 text-cyan-300 border-cyan-800/60",
    full: "bg-zinc-800 text-zinc-200 border-zinc-600",
  };

  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-2 py-1.5 ${
        emphasized ? "border-zinc-600 bg-zinc-900/80" : "border-zinc-800/80 bg-zinc-900/40"
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${codeColors[tone]}`}
      >
        {code}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        <p className="text-[10px] leading-snug text-zinc-500">{hint}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        muted
          ? "border border-zinc-700 text-zinc-500"
          : "border border-emerald-800/60 bg-emerald-950/50 text-emerald-400"
      }`}
    >
      {label}
    </span>
  );
}
