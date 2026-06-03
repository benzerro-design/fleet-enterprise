# Checklist go-live pilot (Q3)

**Scop:** validare cap-coadă pe **staging** înainte de acces limitat pentru clientul pilot.  
**ICP:** administrator flotă / dispecer, ~20–150 vehicule, România — fără tracking GPS.

**Referințe:** `docs/roadmap-2026-q3-q4.md`, `api/README.md` (GCS PDF).

---

## 1. Infrastructură (o dată / după deploy)

**URL-uri staging (referință):**

- API: `https://fleet-api-cxsqhb2qmq-ew.a.run.app`
- Web: `https://fleet-web-stg-1096713529891.europe-west1.run.app` (număr = **project number** GCP, nu îl inventa)

**Intrare aplicație:** rădăcina web (`/`) redirecționează la **login** (anonim) sau **dashboard** (sesiune activă). Nu există pagină MVP publică cu linkuri „Vehicule”.

**Login:** https://fleet-web-stg-1096713529891.europe-west1.run.app/login

| # | Verificare | OK |
|---|------------|-----|
| 1.1 | API Cloud Run `fleet-api` — health `GET /health` → `{ status: "ok" }` | [x] |
| 1.2 | Web Cloud Run `fleet-web-stg` — login se încarcă | [x] |
| 1.3 | `DATABASE_URL` (Neon) — migrări la zi: `npm run db:migrate` din `api/` | [x] |
| 1.4 | `GCS_BUCKET=fleet-enterprise-trip-sheets` pe `fleet-api` (persistă în deploy workflow) | [x] |
| 1.5 | IAM: SA Cloud Run → `roles/storage.objectAdmin` pe bucket | [x] |
| 1.6 | `WEB_ORIGIN` = URL web staging; `JWT_SECRET` setat | ☐ |

---

## 2. Conturi pilot

| # | Verificare | OK |
|---|------------|-----|
| 2.1 | Tenant pilot creat (slug + nume) | ☐ |
| 2.2 | `tenant_admin` — email / parolă transmise securizat | ☐ |
| 2.3 | (Opțional) `tenant_viewer` — doar citire | ☐ |
| 2.4 | Parole Neon / secrete rotite dacă au fost expuse în suport | ☐ |

**Notă:** utilizatori noi încă prin seed / SQL / runbook — fără self-service invite (out of scope Q3).

---

## 3. Date inițiale flotă

| # | Verificare | OK |
|---|------------|-----|
| 3.1 | Clienți (organizații) — CRUD `/fleet/clients`, cod unic per tenant | ☐ |
| 3.2 | ≥ 80% vehicule cu **client valid** (FK), nu cod liber | ☐ |
| 3.3 | ITP / documente reprezentative pe câteva vehicule | ☐ |
| 3.4 | (Staging) seed demo opțional: `npm run db:seed` + `db:seed:trips` | ☐ |

---

## 4. Fluxuri obligatorii (smoke manual — staging)

Rulează cu cont **tenant_admin** al tenantului pilot.

### Panou general

| # | Pas | OK |
|---|-----|-----|
| 4.1 | Login → redirect `/fleet/dashboard` | ☐ |
| 4.2 | KPI-uri se încarcă (&lt; 2s percepție) | ☐ |
| 4.3 | Click KPI → listă pre-filtrată (vehicule, remindere, documente, costuri, curse) | ☐ |

### Clienți & vehicule

| # | Pas | OK |
|---|-----|-----|
| 4.4 | Creează client → vehicul legat de client | ☐ |
| 4.5 | Listă vehicule filtrată după `clientId` | ☐ |

### Curse & FAZ / foi de parcurs

| # | Pas | OK |
|---|-----|-----|
| 4.6 | Cursă nouă pe vehicul pilot | ☐ |
| 4.7 | **Generează document parcurs** — perioadă + vehicule → succes | [x] |
| 4.8 | **Descarcă PDF** — deschide fișier valid (nu 500) | [x] |
| 4.9 | În GCS: obiect `tenants/{slug}/trip-sheets/{id}.pdf` | ☐ |
| 4.10 | FAZ lunar (`faz_monthly`) — generate + download | ☐ |

### Conformitate

| # | Pas | OK |
|---|-----|-----|
| 4.11 | Remindere — listă + filtru `status=action` | ☐ |
| 4.12 | Documente — `expiryStatus=expiring` / `expired` | ☐ |

### Securitate tenant

| # | Pas | OK |
|---|-----|-----|
| 4.13 | `tenant_viewer` — nu poate POST vehicul / generate FAZ | ☐ |
| 4.14 | Fără `X-Tenant-Id` / JWT invalid → 401 pe API | ☐ |

---

## 5. Teste automate (înainte de semnare)

Din `api/` cu `DATABASE_URL` către DB de test (nu producție live dacă nu e izolat):

```bash
npm run test:e2e          # fleet + pilot Q3 (X-Tenant-Id)
npm run test:e2e:rbac     # JWT + roluri (necesită db:seed)
```

**Acoperire pilot Q3 (`pilot-q3.e2e-spec.ts`):** Client CRUD + vehicul, dashboard, trip-sheet generate + PDF, izolare PDF cross-tenant.

| # | Verificare | OK |
|---|------------|-----|
| 5.1 | `test:e2e` verde | [x] |
| 5.2 | `test:e2e:rbac` verde | [x] |

---

## 6. Criterii succes pilot (roadmap)

| Metrică | Țintă |
|---------|--------|
| Incidente tenant leak | **0** |
| Vehicule cu Client FK valid | **100%** (țintă operațională) |
| FAZ / foaie parcurs lunar | **≥ 1** generat + re-descărcat |
| Sesiuni active / săptămână | ≥ 3 (după go-live) |

---

## 7. Semnare go-live

| Rol | Nume | Data | Semnătură |
|-----|------|------|-----------|
| Produs / owner | | | |
| Tehnic | | | |
| Client pilot | | | |

**Limitări cunoscute (Q3):** fără portal user client; fără tracking; user management doar manual; liste mobil = tabele.

---

## URL Cloud Run — de unde vine cifra din link?

Format: `https://{SERVICE}-{PROJECT_NUMBER}.{REGION}.run.app`

| Parte | Exemplu tău |
|--------|-------------|
| Serviciu | `fleet-web-stg` |
| **Project number** (GCP) | `1096713529891` |
| Regiune | `europe-west1` |

**Unde îl vezi corect:** GCP Console → pagina proiectului (Project number) sau Cloud Run → serviciul `fleet-web-stg` → URL afișat sus.

**Greșeală frecventă:** alt număr (ex. `109**8**713529891` în loc de `109**6**713529891`) → 404 pe tot site-ul, deși aplicația e OK pe URL-ul din Console.

**API** poate avea alt host (`fleet-api-cxsqhb2qmq-ew…`) — e normal; nu trebuie același prefix ca web-ul.

## Login lent pe staging (normal, nu e bug de parolă)

Flux: browser → **web Cloud Run** → **API Cloud Run** → **Neon** + `bcrypt` (12 runde, intenționat lent).

| Cauză | Durată tipică |
|--------|----------------|
| Cold start Cloud Run (web sau API) după inactivitate | 1–5 s |
| Neon wake-up (primul query) | 0,5–3 s |
| `bcrypt.compare` (securitate) | ~0,2–0,5 s |
| După login: `GET /auth/me` + `GET /fleet/dashboard` (agregate) | 0,5–3 s |

**Pilot:** în GCP Cloud Run setează **Minimum instances = 1** pe `fleet-api` și `fleet-web-stg` ca să dispară pauza la primul click.

---

## Troubleshooting web 404 (staging)

Dacă URL-ul arată **„Page not found”** pe **fundal alb**, verifică mai întâi că **project number** din link = cel din GCP Console. Dacă e corect și tot 404: revizie Cloud Run lipsă / deploy eșuat → **Actions → Deploy Web to Cloud Run**.

---

## 8. Rollback rapid

1. Cloud Run → revizie API/web anterioară (traffic 100% pe revision stabilă).  
2. Migrări DB: nu face rollback Prisma fără plan — preferă fix forward.  
3. GCS: obiectele rămân; aplicația veche poate citi BYTEA dacă există înregistrări legacy.

---

## Note sesiune pilot

| Data | Observație | Acțiune |
|------|------------|---------|
| 2026-06-03 | URL web greșit în doc: `109871…` vs corect `109671…` (project number); login OK pe URL corect | Folosește doar link din Cloud Run Console |
