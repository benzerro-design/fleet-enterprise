"use client";

import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  centsToRon,
  createRsaPlan,
  loadRsaEnrollments,
  loadRsaPlans,
  loadRsaProfile,
  patchRsaPlan,
  ronToCents,
  rsaEnrollmentStatusLabel,
  roadsideKindLabel,
  ROADSIDE_KINDS,
  saveRsaProfile,
  type RsaEnrollmentRecord,
  type RsaPlanRecord,
  type RsaSupplierProfileRecord,
} from "@/lib/roadside-api";

type Props = {
  supplierId: string;
  canWrite: boolean;
};

const COUNTY_HINT = "ex. B, IF, PH sau ALL_RO (separat prin virgulă)";

export function SupplierRsaPanel({ supplierId, canWrite }: Props) {
  const [profile, setProfile] = useState<RsaSupplierProfileRecord | null>(null);
  const [plans, setPlans] = useState<RsaPlanRecord[]>([]);
  const [enrollments, setEnrollments] = useState<RsaEnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const [is24x7, setIs24x7] = useState(true);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [counties, setCounties] = useState("");
  const [crossBorder, setCrossBorder] = useState(false);
  const [kinds, setKinds] = useState<string[]>([...ROADSIDE_KINDS]);
  const [slaAck, setSlaAck] = useState("10");
  const [slaUrban, setSlaUrban] = useState("45");
  const [slaHighway, setSlaHighway] = useState("60");
  const [calloutRon, setCalloutRon] = useState("");
  const [hookRon, setHookRon] = useState("");
  const [perKmRon, setPerKmRon] = useState("");
  const [winchRon, setWinchRon] = useState("");
  const [nightPct, setNightPct] = useState("0");
  const [brokerOut, setBrokerOut] = useState(false);
  const [brokerIn, setBrokerIn] = useState(false);
  const [brokerAuto, setBrokerAuto] = useState(false);
  const [brokerUrl, setBrokerUrl] = useState("");
  const [brokerApiKey, setBrokerApiKey] = useState("");
  const [brokerInboundSecret, setBrokerInboundSecret] = useState("");
  const [brokerKeyHint, setBrokerKeyHint] = useState<string | null>(null);
  const [brokerSecretHint, setBrokerSecretHint] = useState<string | null>(null);

  const [planCode, setPlanCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [planFeeRon, setPlanFeeRon] = useState("");
  const [planTowKm, setPlanTowKm] = useState("100");
  const [planMobility, setPlanMobility] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, planList, enroll] = await Promise.all([
        loadRsaProfile(supplierId),
        loadRsaPlans(supplierId),
        loadRsaEnrollments({ supplierId, pageSize: 30 }),
      ]);
      setProfile(p);
      setPlans(planList);
      setEnrollments(enroll.items);
      if (p) {
        setIs24x7(p.is24x7);
        setPhone(p.dispatchPhone24x7 ?? "");
        setEmail(p.dispatchEmail ?? "");
        setCounties(p.coverageCounties.join(", "));
        setCrossBorder(p.crossBorderEnabled);
        setKinds(p.supportedKinds.length ? p.supportedKinds : [...ROADSIDE_KINDS]);
        setSlaAck(String(p.slaAckMinutes));
        setSlaUrban(String(p.slaArrivalUrbanMinutes));
        setSlaHighway(String(p.slaArrivalHighwayMinutes));
        setCalloutRon(centsToRon(p.baseCalloutOutPlanCents));
        setHookRon(centsToRon(p.towHookOutPlanCents));
        setPerKmRon(centsToRon(p.towPerKmOutPlanCents));
        setWinchRon(centsToRon(p.winchSurchargeCents));
        setNightPct(String(p.nightWeekendMultiplierPct));
        setBrokerOut(p.brokerOutboundEnabled);
        setBrokerIn(p.brokerInboundEnabled);
        setBrokerAuto(p.brokerAutoDispatch);
        setBrokerUrl(p.brokerApiBaseUrl ?? "");
        setBrokerKeyHint(p.brokerApiKeyLast4);
        setBrokerSecretHint(p.brokerInboundSecretLast4);
        setBrokerApiKey("");
        setBrokerInboundSecret("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare RSA");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSaveProfile() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const savedProfile = await saveRsaProfile(supplierId, {
        is24x7,
        dispatchPhone24x7: phone || null,
        dispatchEmail: email || null,
        coverageCounties: counties
          .split(/[,;]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        crossBorderEnabled: crossBorder,
        supportedKinds: kinds,
        slaAckMinutes: Number(slaAck) || 10,
        slaArrivalUrbanMinutes: Number(slaUrban) || 45,
        slaArrivalHighwayMinutes: Number(slaHighway) || 60,
        baseCalloutOutPlanCents: ronToCents(calloutRon),
        towHookOutPlanCents: ronToCents(hookRon),
        towPerKmOutPlanCents: ronToCents(perKmRon),
        winchSurchargeCents: ronToCents(winchRon),
        nightWeekendMultiplierPct: Number(nightPct) || 0,
        brokerOutboundEnabled: brokerOut,
        brokerInboundEnabled: brokerIn,
        brokerAutoDispatch: brokerAuto,
        brokerApiBaseUrl: brokerUrl || null,
        ...(brokerApiKey.trim() ? { brokerApiKey: brokerApiKey.trim() } : {}),
        ...(brokerInboundSecret.trim()
          ? { brokerInboundSecret: brokerInboundSecret.trim() }
          : {}),
      });
      setProfile(savedProfile);
      setBrokerKeyHint(savedProfile.brokerApiKeyLast4);
      setBrokerSecretHint(savedProfile.brokerInboundSecretLast4);
      setBrokerApiKey("");
      setBrokerInboundSecret("");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function onCreatePlan() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    try {
      await createRsaPlan(supplierId, {
        code: planCode.trim(),
        name: planName.trim(),
        monthlyFeePerVehicleCents: ronToCents(planFeeRon),
        includedTowKm: Number(planTowKm) || 100,
        mobilityIncluded: planMobility,
      });
      setPlanCode("");
      setPlanName("");
      setPlanFeeRon("");
      setPlanTowKm("100");
      setPlanMobility(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare plan eșuată");
    } finally {
      setPending(false);
    }
  }

  async function togglePlanActive(plan: RsaPlanRecord) {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    try {
      await patchRsaPlan(plan.id, { active: !plan.active });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Actualizare plan eșuată");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Se încarcă profilul RSA…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Profil operațional asistență</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Dispecerat 24/7, acoperire județe, SLA și rate card pay-per-use / out-of-plan.
          {!profile ? " Nu există profil — salvați pentru a crea unul." : null}
        </p>
      </div>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Profil salvat.</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={is24x7}
            disabled={!canWrite || pending}
            onChange={(e) => setIs24x7(e.target.checked)}
          />
          Disponibil 24/7
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={crossBorder}
            disabled={!canWrite || pending}
            onChange={(e) => setCrossBorder(e.target.checked)}
          />
          Cross-border
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Telefon dispecerat</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Email dispecerat</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={OPS_LABEL_CLASS}>Județe acoperite</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={counties}
            onChange={(e) => setCounties(e.target.value)}
            placeholder={COUNTY_HINT}
          />
        </label>
        <div className="sm:col-span-2">
          <span className={OPS_LABEL_CLASS}>Capabilități</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {ROADSIDE_KINDS.map((k) => (
              <label key={k} className="flex items-center gap-1.5 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  disabled={!canWrite || pending}
                  checked={kinds.includes(k)}
                  onChange={(e) => {
                    setKinds((prev) =>
                      e.target.checked ? [...prev, k] : prev.filter((x) => x !== k),
                    );
                  }}
                />
                {roadsideKindLabel(k)}
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>SLA ack (min)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={slaAck}
            onChange={(e) => setSlaAck(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>SLA urban (min)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={slaUrban}
            onChange={(e) => setSlaUrban(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>SLA autostradă (min)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={slaHighway}
            onChange={(e) => setSlaHighway(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Majorare noapte/weekend (%)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={nightPct}
            onChange={(e) => setNightPct(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Callout out-of-plan (RON)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={calloutRon}
            onChange={(e) => setCalloutRon(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Cârlig tractare (RON)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={hookRon}
            onChange={(e) => setHookRon(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Km tractare (RON/km)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={perKmRon}
            onChange={(e) => setPerKmRon(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Troliu (RON)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={winchRon}
            onChange={(e) => setWinchRon(e.target.value)}
            inputMode="decimal"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <h4 className="text-sm font-medium text-zinc-200">Broker / 24×7 API (S5)</h4>
        <p className="text-xs text-zinc-500">
          Outbound: POST {"{baseUrl}"}/v1/rsa/dispatch. Inbound webhook:{" "}
          <code className="text-zinc-400">POST /roadside/broker/webhook</code> cu{" "}
          <code className="text-zinc-400">X-RSA-Broker-Secret</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={brokerOut}
              disabled={!canWrite || pending}
              onChange={(e) => setBrokerOut(e.target.checked)}
            />
            Outbound activ
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={brokerIn}
              disabled={!canWrite || pending}
              onChange={(e) => setBrokerIn(e.target.checked)}
            />
            Inbound webhook activ
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={brokerAuto}
              disabled={!canWrite || pending}
              onChange={(e) => setBrokerAuto(e.target.checked)}
            />
            Auto-dispatch la crearea intervenției
          </label>
          <label className="block sm:col-span-2">
            <span className={OPS_LABEL_CLASS}>Broker API base URL</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={!canWrite || pending}
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              placeholder="https://broker.example.com"
            />
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>
              API key outbound{brokerKeyHint ? ` (···${brokerKeyHint})` : ""}
            </span>
            <input
              className={OPS_INPUT_CLASS}
              type="password"
              autoComplete="new-password"
              disabled={!canWrite || pending}
              value={brokerApiKey}
              onChange={(e) => setBrokerApiKey(e.target.value)}
              placeholder={brokerKeyHint ? "Lasă gol ca să păstrezi" : "Cheie nouă"}
            />
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>
              Secret inbound{brokerSecretHint ? ` (···${brokerSecretHint})` : ""}
            </span>
            <input
              className={OPS_INPUT_CLASS}
              type="password"
              autoComplete="new-password"
              disabled={!canWrite || pending}
              value={brokerInboundSecret}
              onChange={(e) => setBrokerInboundSecret(e.target.value)}
              placeholder={brokerSecretHint ? "Lasă gol ca să păstrezi" : "Secret webhook"}
            />
          </label>
        </div>
      </div>

      {canWrite ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void onSaveProfile()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Salvează profil RSA
        </button>
      ) : null}

      <div className="border-t border-zinc-800 pt-6">
        <h3 className="text-sm font-medium text-zinc-200">Planuri abonament</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Catalog planuri pe vehicul. Înrolarea se face din profilul vehiculului.
        </p>

        {plans.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun plan încă.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <span className="font-mono text-zinc-300">{p.code}</span>
                  <span className="ml-2 text-zinc-200">{p.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {centsToRon(p.monthlyFeePerVehicleCents)} RON/lună · {p.includedTowKm} km
                    {p.mobilityIncluded ? " · mobilitate" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${p.active ? "text-emerald-400" : "text-zinc-500"}`}
                  >
                    {p.active ? "activ" : "inactiv"}
                  </span>
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void togglePlanActive(p)}
                      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                    >
                      {p.active ? "Dezactivează" : "Activează"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Cod plan</span>
              <input
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
                placeholder="RSA-BASIC"
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Denumire</span>
              <input
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Asistență Basic"
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Taxă lunară (RON)</span>
              <input
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={planFeeRon}
                onChange={(e) => setPlanFeeRon(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Km tractare incluși</span>
              <input
                className={OPS_INPUT_CLASS}
                disabled={pending}
                value={planTowKm}
                onChange={(e) => setPlanTowKm(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                disabled={pending}
                checked={planMobility}
                onChange={(e) => setPlanMobility(e.target.checked)}
              />
              Mobilitate inclusă
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={pending || !planCode.trim() || !planName.trim()}
                onClick={() => void onCreatePlan()}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
              >
                Adaugă plan
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <h3 className="text-sm font-medium text-zinc-200">Înrolări recente</h3>
        {enrollments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nicio înrolare pe acest furnizor.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
            {enrollments.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className="text-zinc-200">
                  {e.vehicleReg ?? e.vehicleId} · {e.planCode}
                </span>
                <span className="text-xs text-zinc-500">
                  {rsaEnrollmentStatusLabel(e.status)} · {e.validFrom}
                  {e.validUntil ? ` → ${e.validUntil}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
