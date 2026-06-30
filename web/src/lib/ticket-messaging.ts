export const TICKET_REPLY_TEMPLATES = [
  {
    id: "itp-schedule",
    label: "ITP — programare",
    text: "Am preluat solicitarea ITP. Revenim cu dată și locație în maximum 24h.",
  },
  {
    id: "damage-info",
    label: "Daună — detalii",
    text: "Pentru dosarul de daună avem nevoie de: poze clară, loc/ora evenimentului, martori (dacă există), nr. alt vehicul implicat.",
  },
  {
    id: "damage-received",
    label: "Daună — primit",
    text: "Am înregistrat dauna. Urmează evaluare service și contact de la asigurător.",
  },
  {
    id: "maintenance-slot",
    label: "Mentenanță",
    text: "Am programat vehiculul la service. Confirmăm intervalul și estimarea cost după diagnoză.",
  },
  {
    id: "docs-missing",
    label: "Documente lipsă",
    text: "Lipsesc documente pentru închiderea tichetului. Te rugăm să încarci sau să răspunzi cu detaliile solicitate.",
  },
] as const;

export const TICKET_REACTION_EMOJIS = ["👍", "✅", "❓", "👀"] as const;

export const TICKET_POLL_INTERVAL_MS = 15_000;
