import Link from "next/link";

type Cell = "da" | "nu";

const PROFILES = ["F", "T", "G", "Full", "Fără profil"] as const;

const PROFILE_RIGHTS: { right: string; detail: string; cells: Cell[] }[] = [
  {
    right: "Aprobă devizul",
    detail: "Devizul trimis spre aprobare. La client, doar administratorul de client, nu dispecerul.",
    cells: ["da", "nu", "nu", "da", "da"],
  },
  {
    right: "Editează devizul",
    detail: "Linii, cantități, prețuri, versiune nouă.",
    cells: ["nu", "da", "nu", "da", "da"],
  },
  {
    right: "Trece costul după factură",
    detail: "Costul pornește din devizul facturat. Dispecerul cu F sau Full poate și el.",
    cells: ["da", "nu", "nu", "da", "da"],
  },
  {
    right: "Programează service",
    detail: "Programare, intrare în service, ieșire din service pe tichet.",
    cells: ["nu", "nu", "da", "da", "da"],
  },
  {
    right: "Scrie în flotă",
    detail: "Curse, costuri și celelalte înregistrări operaționale.",
    cells: ["nu", "da", "da", "da", "da"],
  },
];

const WHO: { who: string; gets: string }[] = [
  {
    who: "Administrator abonat (L*)",
    gets: "Primește profilul. Setup, membri și această hartă rămân deschise și când profilul e F.",
  },
  {
    who: "Cititor abonat",
    gets: "Doar vede. Profilul F/T/G nu îi dă scriere.",
  },
  {
    who: "Administrator client (L1)",
    gets: "Primește tot ce e în profil, inclusiv aprobarea devizului.",
  },
  {
    who: "Dispecer client (L1)",
    gets: "Primește editarea, programarea, costul și flota din profil. Aprobarea devizului rămâne la administratorul de client, inclusiv dacă dispecerul e Full.",
  },
  {
    who: "Doar citire",
    gets: "Doar vede. Selectorul de profil nu îi adaugă drepturi.",
  },
  {
    who: "Șofer (L0)",
    gets: "Portalul lui: vehicul, curse, costuri, tichete. Ieșirea din service doar dacă bifa din Setup → Comenzi e pornită. F/T/G nu îi schimbă portalul.",
  },
  {
    who: "Partener (R*, R1, R0)",
    gets: "Lucrează pe comenzile atelierului. Nu are profil F/T/G.",
  },
];

export function UserStrategyRights() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">Drepturi</p>
      <h2 className="mt-1 text-lg font-semibold text-zinc-50">Ce poate face fiecare profil</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Rolul stabilește nivelul: abonat, client, șofer sau partener. Profilul F, T, G sau Full împarte munca în
        interiorul nivelului. Se alocă pe rândul omului, în{" "}
        <Link href="/fleet/members" className="text-emerald-400 hover:underline">
          Membri & invitații
        </Link>
        . Harta de deasupra ține structura. Rubrica de aici este ce aplică aplicația.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">Drepturi pe profilul F, T, G, Full și fără profil</caption>
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4 font-medium">Drept</th>
              {PROFILES.map((profile) => (
                <th key={profile} className="px-2 py-2 text-center font-medium">
                  {profile}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROFILE_RIGHTS.map((row) => (
              <tr key={row.right} className="border-b border-zinc-800/80 align-top">
                <th className="py-3 pr-4 font-medium text-zinc-100">
                  {row.right}
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">{row.detail}</span>
                </th>
                {row.cells.map((cell, index) => (
                  <td
                    key={PROFILES[index]}
                    className={`px-2 py-3 text-center text-xs font-medium ${
                      cell === "da" ? "text-emerald-300" : "text-zinc-600"
                    }`}
                  >
                    {cell === "da" ? "da" : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Fără profil înseamnă contul vechi: rolul păstrează toate drepturile pe care le avea înainte de F/T/G.
      </p>

      <h3 className="mt-8 text-sm font-semibold text-zinc-100">Cui i se alocă</h3>
      <ul className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
        {WHO.map((row) => (
          <li key={row.who} className="grid gap-1 bg-zinc-950/40 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <p className="text-sm font-medium text-zinc-100">{row.who}</p>
            <p className="text-sm text-zinc-400">{row.gets}</p>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-sm font-semibold text-zinc-100">Față de cardurile din hartă</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
        <li>
          La client, cardul <span className="text-zinc-200">T</span> spune programări. În aplicație programarea este la{" "}
          <span className="text-zinc-200">G</span>.
        </li>
        <li>
          Cardul <span className="text-zinc-200">G</span> spune curse. În aplicație cursele le scriu și{" "}
          <span className="text-zinc-200">T</span>, și <span className="text-zinc-200">G</span>.
        </li>
        <li>
          Cardul <span className="text-zinc-200">F</span> de la client spune doar aprobarea bugetului. În aplicație F
          aprobă devizul și trece costul după factură.
        </li>
        <li>Cardurile F, T și G sunt încă marcate planificat. Restricția rulează deja la login.</li>
      </ul>
    </section>
  );
}
