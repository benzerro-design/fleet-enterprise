# UI shell — Variant C

## Layout

- **Desktop (`lg`, ≥1024px):** sidebar fix 260px, grupuri din `web/src/lib/fleet-nav.ts`, conținut fluid `max-w-[90rem]`.
- **Mobil:** header (Meniu + tenant + ieșire), drawer full-height cu aceleași grupuri (collapsible), bară jos (Acasă, Vehicule, Curse, Remindere, Mai mult).

## Pagini

- Wrapper comun: `FleetPageMain` — fără `max-w-5xl` global; formulare înguste pot folosi `narrow="sm"|"md"`.
- Sub-nav în pagină (ex. Curse: Listă · Documente · Tahograf) rămâne tab-uri locale, nu item separat în sidebar.

## Navigare

- Rute **live** în sidebar; module viitoare apar dezactivate cu badge F1/F2/·.
- **Administrare** (footer sidebar): Membri (admin), Audit (autentificat), Setări (F1).

## Faze ulterioare

- `PageHeader`, `FilterBar`, KPI row pe liste.
- Liste responsive: tabel desktop, carduri sub `lg`.
