export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  /** Secțiuni scurte — faza 1: conținut static în produs. */
  sections: Array<{ heading: string; body: string[] }>;
  relatedHrefs?: Array<{ label: string; href: string }>;
};

/**
 * HELP-001 — catalog Admin L* (faza 1).
 * Nu e PROC-001 (proceduri de lucru pe tabere); aici = ghid produs / „cum funcționează”.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "ierarhie-l-r",
    title: "Cine e L**, L*, L1, L0 și R*",
    summary: "Ierarhia de acces pe scurt — abonat, client, șofer, partener.",
    sections: [
      {
        heading: "Pe scurt",
        body: [
          "L** = owner platformă (tu ca vendor). Gestionează abonații — încă nu e consolă în app (IAM-001).",
          "L* = admin abonat (tenant). Vede tot din tenant-ul lui: clienți, mașini, useri, parteneri.",
          "L1 = manager / dispecer al unui Client contractual. Scope pe firma lui.",
          "L0 = șofer / user mașină pe Client.",
          "R* / R1 = partener furnizor (service, piese…). Axă separată; alocat pe clienți în același tenant.",
        ],
      },
      {
        heading: "Regulă de aur",
        body: [
          "Un abonat = un tenant izolat. Client ≠ abonat. Partenerii nu sunt «sub» L0 — sunt pe axa R.",
        ],
      },
    ],
    relatedHrefs: [
      { label: "Membri abonat", href: "/fleet/members" },
      { label: "Strategie useri", href: "/fleet/user-strategy" },
    ],
  },
  {
    slug: "programari-politici",
    title: "Programări: politici pe client",
    summary: "Negociere manager∥șofer, Mode A/B, acord șofer, istoric propuneri.",
    sections: [
      {
        heading: "Unde se setează",
        body: [
          "Configurare client → Politici (sau pe fișa Client → drepturi / politici programări).",
          "Setările sunt per Client, nu globale pe tenant.",
        ],
      },
      {
        heading: "Ce controlează bifăle actuale",
        body: [
          "Șoferul poate decide data (negociere): Confirmă și Propune apar în paralel pentru manager și șofer; WO după acceptul ambilor.",
          "Mode A — Rapid la atelier: Propune merge direct la furnizor.",
          "Mode B — Mai întâi flotă: Propune stă între peeri până Confirmă/Propune celălalt, apoi la furnizor.",
          "Fără negociere: flux mai scurt; acord șofer poate fi pe bifă separată (requireDriverAck) sau ordin ierarhic.",
          "Istoric propuneri: tab-uri Curente/Istoric pe PROGRAMĂRI pentru manager; L* le vede oricum.",
        ],
      },
      {
        heading: "Recomandare",
        body: [
          "Default sănătos = flux simplu. Negocierea completă = opt-in pe clienții care chiar o cer.",
          "Pe termen: tipologii self-service / full-managed vor aduce șabloane (SETUP-011 / IAM-013).",
        ],
      },
    ],
    relatedHrefs: [
      { label: "Setup clienți", href: "/fleet/setup/clients" },
      { label: "Programator", href: "/fleet/scheduler" },
    ],
  },
  {
    slug: "programari-proxy-lstar",
    title: "L* pe programări (proxy)",
    summary: "Adminul apasă aceleași butoane ca rolurile; istoric cu * și audit cu adevărul.",
    sections: [
      {
        heading: "Cum funcționează",
        body: [
          "L* nu apare ca al patrulea vot pe ecran. Folosește Confirmă (manager), Confirmă (șofer), Validează (furnizor), Propune.",
          "În istoric: manager* / șofer* / furnizor* când L* a acționat în numele rolului.",
          "În Audit (Admin): «L* în numele …» — adevărul operational.",
        ],
      },
      {
        heading: "Full-managed",
        body: [
          "Dacă abonatul administrează mașinile fără manager client de decizie, L* este decidentul — etichetele «manager» pot suna confuz; tipologia client (viitor) va clarifica CTA-urile.",
        ],
      },
    ],
    relatedHrefs: [
      { label: "Audit", href: "/fleet/audit" },
      { label: "Tichete", href: "/fleet/tickets" },
    ],
  },
  {
    slug: "repropunere-acelasi-slot",
    title: "Repropunere: același slot e blocat",
    summary: "Nu poți cere reprogramare pe aceeași dată/oră.",
    sections: [
      {
        heading: "Comportament",
        body: [
          "La Propune / drag pe alt slot, dacă alegi aceeași dată și oră (același minut), apare avertizarea și API refuză.",
          "Validează (furnizor) fără a schimba ora rămâne permis — e accept, nu repropunere.",
          "Se aplică flotei și partenerului.",
        ],
      },
    ],
  },
  {
    slug: "membri-invite",
    title: "Membri și invitații",
    summary: "Hub Abonat / Client / Furnizor; link 7 zile; parola o alege destinatarul.",
    sections: [
      {
        heading: "Unde inviți",
        body: [
          "Administrare → Membri: taburi Abonat, Client, Furnizor.",
          "Pe Client → Echipă: L1 își poate invita oamenii (dacă are dreptul).",
          "Partener: invitații pe furnizor / portal partener.",
        ],
      },
      {
        heading: "Ce lipsește încă (backlog)",
        body: [
          "Reset / înlocuire parolă de pe Membri (IAM-011).",
          "Drepturi fine ca L1 să gestioneze userii echipei cu constrângeri (IAM-012).",
        ],
      },
    ],
    relatedHrefs: [{ label: "Membri abonat", href: "/fleet/members" }],
  },
  {
    slug: "help-vs-proceduri",
    title: "Help vs proceduri de lucru",
    summary: "De ce există două concepte — și ce e faza 1.",
    sections: [
      {
        heading: "Help (acest modul)",
        body: [
          "Explică cum funcționează produsul: roluri, bifă, fluxuri. Faza 1: doar Admin L*.",
          "Ulterior: drepturi Help și pentru alte roluri.",
        ],
      },
      {
        heading: "Proceduri (PROC-001 — separat)",
        body: [
          "Proceduri de lucru pe tabere (Abonat / Client / Partener) — «cum facem noi la firmă».",
          "Nu se amestecă aici; granița rămâne de discutat cu produsul.",
        ],
      },
    ],
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
