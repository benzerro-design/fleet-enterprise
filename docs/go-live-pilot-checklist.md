# Checklist go-live pilot (Q3)

**Scop:** validare cap-coadă pe **staging** înainte de acces limitat pentru clientul pilot.  
**ICP:** administrator flotă / dispecer, ~20–150 vehicule, România — fără tracking GPS.

**Referințe:** [`identity-access-model.md`](identity-access-model.md) (IAM canonic), `docs/roadmap-2026-q3-q4.md`, `api/README.md` (GCS PDF), **`docs/pilot-handoff-flotax.md`** (text predare client).

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
| 1.4b | `GCS_BUCKET` pe `fleet-web-stg` (upload-uri documente/poze persistente) | ☐ |
| 1.5 | IAM: SA Cloud Run → `roles/storage.objectAdmin` pe bucket (API **și** web) | [x] |
| 1.5b | Vision API enabled pe proiect + SA API `roles/cloudvision.user` (OCR CIV) | ☐ |
| 1.6 | `WEB_ORIGIN` = URL web staging; `JWT_SECRET` setat | [x] |

---

## 2. Conturi pilot

| # | Verificare | OK |
|---|------------|-----|
| 2.1 | Tenant pilot creat (slug + nume) | [x] |
| 2.2 | `tenant_admin` — email / parolă transmise securizat | [x] |
| 2.3 | (Opțional) `tenant_viewer` — doar citire | [x] |
| 2.4 | Parole Neon / secrete rotite dacă au fost expuse în suport | ☐ |

**Notă:** utilizatori noi încă prin seed / SQL / runbook — fără self-service invite (out of scope Q3).

---

## 3. Date inițiale flotă

| # | Verificare | OK |
|---|------------|-----|
| 3.1 | Clienți (organizații) — CRUD `/fleet/clients`, cod unic per tenant | [x] |
| 3.2 | ≥ 80% vehicule cu **client valid** (FK), nu cod liber | [x] |
| 3.3 | ITP / documente reprezentative pe câteva vehicule | [x] |
| 3.4 | (Staging) seed demo opțional: `npm run db:seed` + `db:seed:trips` | [x] |

---

## 4. Fluxuri obligatorii (smoke manual — staging)

Rulează cu cont **tenant_admin** al tenantului pilot.

### Panou general

| # | Pas | OK |
|---|-----|-----|
| 4.1 | Login → redirect `/fleet/dashboard` | [x] |
| 4.2 | KPI-uri se încarcă (&lt; 2s percepție) | [x] |
| 4.3 | Click KPI → listă pre-filtrată (vehicule, remindere, documente, costuri, curse) | [x] |

### Clienți & vehicule

| # | Pas | OK |
|---|-----|-----|
| 4.4 | Creează client → vehicul legat de client | [x] |
| 4.5 | Listă vehicule filtrată după `clientId` | [x] |

### Curse & FAZ / foi de parcurs

| # | Pas | OK |
|---|-----|-----|
| 4.6 | Cursă nouă pe vehicul pilot | [x] |
| 4.7 | **Generează document parcurs** — perioadă + vehicule → succes | [x] |
| 4.8 | **Descarcă PDF** — deschide fișier valid (nu 500) | [x] |
| 4.9 | În GCS: obiect `tenants/{slug}/trip-sheets/{id}.pdf` | [x] |
| 4.10 | FAZ lunar (`faz_monthly`) — generate + download | [x] |

### Conformitate

| # | Pas | OK |
|---|-----|-----|
| 4.11 | Remindere — listă + filtru `status=action` | [x] |
| 4.12 | Documente — `expiryStatus=expiring` / `expired` | [x] |

### Securitate tenant

| # | Pas | OK |
|---|-----|-----|
| 4.13 | `tenant_viewer` — nu poate POST vehicul / generate FAZ | [x] |
| 4.14 | Fără `X-Tenant-Id` / JWT invalid → 401 pe API | [x] |

### CRM & flux service (tichet → programator → deviz → închidere)

Rulează cu **tenant_admin** (`admin@demo.local`). Apoi repetă pașii **4.20–4.21** cu **manager client** (`manager.alpha@demo.local`).

**Smoke API automat** (din `api/`):

```bash
node scripts/smoke-staging-service-flow.mjs
node scripts/smoke-staging-service-flow.mjs --write   # creează tichet+WO pe demo
```

| # | Pas | OK |
|---|-----|-----|
| 4.15 | `GET /health` + login admin + `GET /appointments/stats` | ☐ |
| 4.16 | **Programator** `/fleet/scheduler` — KPI + calendar (desktop sau mobil) | ☐ |
| 4.17 | Tichet nou (reparație) cu vehicul → **Pornește dosar lucrare** în stepper | ☐ |
| 4.18 | Programare (din stepper sau Programator) → apare în calendar | ☐ |
| 4.19 | **Devize & comenzi** — deviz draft → trimite → aprobă → post-cost → factură → finalizează WO | ☐ |
| 4.20 | Dosar tichet = etapa **Închis**; stepper fără erori | ☐ |
| 4.21 | `manager.alpha@demo.local` — Programator se încarcă (nu redirect panou); calendar doar client Alpha | ☐ |
| 4.22 | Manager poate confirma/anula programare proprie; `client_viewer` doar citire | ☐ |

**Legături de verificat (B light):** din Programator → tichet sursă; din tichet → WO; din WO → furnizor.

---

## Continuare pilot — rundă curentă (ordine)

**Cont smoke staging (seed pe Neon):** `admin@demo.local` / `demo12345` / tenant `demo`. Viewer: `viewer@demo.local`, aceeași parolă.

### Pas A — Console GCP (≈ 5 min) → bifează 1.6

1. **Cloud Run** → `fleet-api` → tab **Variables & secrets**
2. **WEB_ORIGIN** = `https://fleet-web-stg-1096713529891.europe-west1.run.app` (fără slash final, fără `/login`)
3. **JWT_SECRET** = referință Secret Manager (nu gol)
4. GitHub **Settings → Secrets → Actions**: `WEB_ORIGIN` același URL (pentru deploy API viitor)
5. După modificare env: așteaptă revizie nouă sau **Redeploy** dacă login eșuează cu CORS (rar — web folosește proxy server-side)

### Pas A2 — SMTP Gmail (avizare / reconstatare / deviz)

Vezi ghidul scurt: [`docs/smtp-gmail.md`](./smtp-gmail.md).

1. Generează **App Password** Gmail  
2. GitHub Actions secrets: `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`  
3. Redeploy API (sau Re-run failed) → pe dosar, mail = **sent** (nu stubbed)

### Pas B — Browser cu admin demo (≈ 15 min) → 4.1–4.5, 4.11–4.12

| Pas | Unde în app | Bifează |
|-----|-------------|---------|
| 4.1 | Login → ajungi la **Acasă / Dashboard** (nu pagina MVP) | [x] |
| 4.2 | KPI-uri vizibile; acceptabil dacă &lt; 3s prima dată (cold start) | [x] |
| 4.3 | Click fiecare KPI → listă cu filtre (vehicule, remindere, etc.) | [x] |
| 4.4 | **Clienți** → client nou → **Vehicule** → vehicul cu client selectat | [x] |
| 4.5 | Listă vehicule → filtru client în URL `?clientId=…` | [x] |
| 4.11 | **Remindere** → filtru status acțiune | [x] |
| 4.12 | **Documente** → expiring / expired | [x] |

### Pas C — Curse & PDF (≈ 10 min) → 4.6, 4.9, 4.10

| Pas | Unde | Bifează |
|-----|------|---------|
| 4.6 | **Curse** → cursă nouă pe un vehicul | [x] |
| 4.9 | GCP **Storage** → bucket `fleet-enterprise-trip-sheets` → `tenants/demo/trip-sheets/{id}.pdf` | [x] |
| 4.10 | **Curse** → Generează foaie / FAZ → tip **FAZ lunar** → generate + download PDF | [x] |

### Pas D — RBAC manual (≈ 5 min) → 4.13

1. Logout → login `viewer@demo.local` / `demo` / `demo12345`
2. Încearcă **Vehicul nou** sau **Generează foaie** → trebuie refuz (403 sau buton ascuns)
3. Bifează 4.13

### Pas F — Flux service CRM (≈ 20 min) → 4.15–4.22

1. `cd api` → `node scripts/smoke-staging-service-flow.mjs` (toate ✓)
2. Login **admin@demo.local** → parcurge 4.16–4.20 în browser (vezi tabel §4)
3. Login **manager.alpha@demo.local** → 4.21–4.22
4. (Opțional) `node scripts/smoke-staging-service-flow.mjs --write` — verifică tichetul generat în UI

### Pas E — Conturi pilot reali (când ai clientul) → secțiunea 2 + 3

**Tenant FlotaX (staging):**

| Rol | Email (login) | Display | Tenant slug |
|-----|---------------|---------|-------------|
| Administrator FlotaX | `flotax_admin@flotax.local` | FlotaX_Admin | `flotax` |

Login: emailul e **lowercase** automat; slug **`flotax`** (nu `FlotaX` — slug-ul din DB e lowercase).

**Creare (o dată), din `api/` cu `DATABASE_URL` = Neon staging în `api/.env` (copiat din Secret Manager GCP).**

**CMD (Windows) — fără spații în jurul `=`:**

```cmd
cd /d c:\path\fleet-enterprise\api
set PILOT_FLOTAX_PASSWORD=ParolaTaSigura-min-10-chars
npm run db:seed:flotax
npm run db:verify:flotax
```

**PowerShell:**

```powershell
$env:PILOT_FLOTAX_PASSWORD = "ParolaTaSigura-min-10-chars"
npm run db:seed:flotax
npm run db:verify:flotax
```

> **Atenție CMD:** `set VAR = valoare` (cu spații) **nu** setează variabila corect → parola din seed ≠ parola de login. Folosește **`set VAR=valoare`**.

Nu atinge tenantul **`demo`**. Parola se transmite clientului securizat; nu o pune în repo.

După seed: date flotă (clienți, vehicule, ITP) din UI ca **FlotaX_Admin** → secțiunea 3.

- Tenant nou (generic): **seed / SQL** (vezi `api/scripts/seed-pilot-flotax.js` ca model)
- Transmite parole prin canal securizat; nu folosi `demo12345` în producție pilot

**Verificat automat (sesiune):** API health OK; `/` → 307 `/login`; login demo 200; dashboard 200 (~0,9s); `GET /fleet/vehicles` fără JWT → 401.

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

**Predare client:** completează checklist + email din `docs/pilot-handoff-flotax.md` (§1 intern, §4 text client, §3 suport).

| Rol | Nume | Data | Semnătură |
|-----|------|------|-----------|
| Produs / owner | | | |
| Tehnic | | | |
| Client pilot (FlotaX) | | | |

**Limitări cunoscute (Q3):** fără portal user client; fără tracking; user management doar manual; liste mobil = tabele. Detaliu IAM: [`identity-access-model.md`](identity-access-model.md) §5–§9.

**Concluzie pilot FlotaX (2026-06):** toate modulele testate pe useri noi (`flotax`); 1 vehicul — costuri, documente, remindere, curse, mentenanță — **funcționează**. Îmbunătățiri incrementale pe parcurs.

**Revenire obligatorie:** modul **Curse** — **Faza A §10 parțial livrată** (tab Consum, L/100km segmente, reconciliere); urmează **odometru CAN** (§10.1) + integrare tracking.

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
| 2026-05-31 | Deploy web: `/`→login; smoke API login+dashboard+401; ghid „Continuare pilot” în checklist | Parcurge Pas A→D; 1.6 în Console |
| 2026-05-31 | Pas A: `WEB_ORIGIN` = fleet-web-stg URL; `JWT_SECRET` = Secret Manager | 1.6 bifat; Pas B următor |
| 2026-05-31 | Pas B smoke manual 4.1–4.5, 4.11–4.12 OK | Pas C–D + fix reset filtre |
| 2026-06-03 | Pas C: cursă nouă, PDF în GCS, FAZ lunar generate + download | Pas D (viewer RBAC) următor |
| 2026-06-03 | Pas D: viewer — butoane creare vehicul / generate FAZ ascunse | Secțiunea 4 completă; Pas E + semnare |
| 2026-06-03 | FlotaX: toate modulele OK (1 vehicul); consum curse → backlog obligatoriu + tracking | Semnare §7; scalare date flotă |
| 2026-06-21 | **Feedback §5.1 (Curse/Consum):** tab Consum, distanță auto din odometru, filtre collapsible, reconciliere km; calitate date alimentări | Livrat pe `main`; CAN odometru → roadmap §10.1 |
| 2026-06-18 | **Feedback scurt (pilot-handoff §5.1):** UX formulare ops, profil vehicul, mentenanță garanție/daună, vehicul fixat la edit | Livrat pe `main`; punct 7 ghid prima săptămână atins |
| 2026-05-31 | **Feedback scurt (pilot-handoff §5 zi 7 / §5.1):** liste ops — scroll sub filtre, header sticky, card lists, toolbar remindere | Livrat pe `main`; compactare antet+filtre neacționată |
