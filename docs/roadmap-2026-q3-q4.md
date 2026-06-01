# Roadmap trimestrial 2026 — client pilot

Acest document fixează **cum continuăm** după shell Variant C, FAZ-lite și ops core. Este aliniat la `release-governance.md` (cadenta trimestrială) și la gap-ul identificat față de `phase1-mvp-scope.md`.

**ICP ales:** **client pilot** — o firmă reală (sau divizie internă) care folosește zilnic aplicația pentru evidența flotei, conformitate și raportare, **fără GPS/tracking în Q3–Q4**.

---

## 1. ICP — client pilot

| Dimensiune | Definiție |
|------------|-----------|
| **Cine** | Administrator flotă / dispecer + eventual contabil (același tenant) |
| **Mărime** | ~20–150 vehicule (mix turism, van, cap tractor — nu e critic la început) |
| **Geografie** | România |
| **Job-to-be-done** | Știe ce expiră (ITP, documente), închide remindere, generează FAZ/foi de parcurs, vede costuri și mentenanță **per client contractual** |
| **Nu în scope pilot** | Hartă live, tahograf integrat, portal furnizori, facturare, pachete `T+P*` |
| **Succes pilot** | Folosire săptămânală ≥ 8 săptămâni; ≥ 80% vehicule cu client asignat (entitate); ≥ 1 pachet FAZ lunar generat și re-descărcat; zero incidente tenant leak |

**Implicație produse:** tot ce construim în Q3–Q4 trebuie să fie **demonstrabil cap-coadă** pentru acest utilizator, nu „meniu pregătit pentru viitor”.

---

## 2. Stare curentă (baseline — iunie 2026)

**Livrat și pe `main`:**

- Multi-tenant, JWT, roluri `tenant_admin` / `tenant_viewer`, audit, membri
- Vehicule (CIV extins, ITP, odometru, plan mentenanță), documente, remindere, mentenanță, costuri, curse
- FAZ-lite: PDF foaie de parcurs + FAZ lunar, arhivă, filtre, seed demo
- UI shell Variant C (`fleet-nav.ts`, sidebar grupat, mobil drawer + bottom bar)
- Deploy: API Cloud Run, web staging, Neon Postgres

**Datorii explicite de adresat în Q3:**

- `Vehicle.clientId` = string liber (fără `Client`)
- PDF în `TripSheetDocument.pdfData` (BYTEA)
- Fără dashboard / KPI agregate
- Liste mobil = încă tabele; fără CRM

---

## 3. Q3 2026 (iulie – septembrie) — Client + dashboard + storage

**Obiectiv trimestru:** pilotul poate lucra **per organizație client**, vede **situația flotei într-un singur ecran**, iar documentele PDF **nu mai umflă baza de date**.

### 3.1 Epic: Modul Client (organizații)

| Livrabil | Detaliu |
|----------|---------|
| Schema | `Client` (tenant-scoped): `id`, `code`, `legalName`, `taxId?`, `status`, `notes`, timestamps |
| Migrare | Mapare `Vehicle.clientId` string → `clientId` FK (păstrare `code` pentru compatibilitate sau migrare one-shot din valori existente) |
| API | CRUD `/clients`, listă paginată, filtru activ/inactiv |
| Web | Listă + formular; selector Client pe vehicul, curse, remindere, costuri, mentenanță, wizard FAZ |
| Nav | Item „Clienți (organizații)” → **live** în `fleet-nav.ts` |
| Audit | create/update/delete Client |

**Criterii acceptanță:**

- [ ] Nu se poate salva vehicul fără client valid (sau politică explicită „client intern” unic per tenant)
- [ ] Filtre listă vehicule / curse / FAZ după `clientId` real
- [ ] Export CSV vehicule include denumire client, nu doar cod

**Out of scope Q3:** contacte multiple, adrese, contracte SLA, portal pentru client final.

### 3.2 Epic: Panou general (dashboard)

| Livrabil | Detaliu |
|----------|---------|
| Rută | `/fleet` sau `/fleet/dashboard` — prima destinație după login (redirect din Acasă mobil) |
| KPI (minim) | Total vehicule active; ITP în 30/60 zile; remindere deschise / overdue; documente expirate sau în 30 zile; costuri luna curentă (sumar); curse luna curentă (count) |
| API | `GET /fleet/dashboard` sau agregate în servicii existente (un endpoint dedicat preferat) |
| UI | `FleetPageMain` + grid KPI + 2 liste scurte (remindere due, ITP soon) |
| Nav | „Panou general” → **live** |

**Criterii acceptanță:**

- [ ] Timp încărcare dashboard p95 &lt; 2s pe staging (tenant demo, &lt; 200 vehicule)
- [ ] Click pe KPI duce la listă pre-filtrată

### 3.3 Epic: Stocare documente PDF (object storage)

| Livrabil | Detaliu |
|----------|---------|
| Storage | GCS bucket (același proiect GCP); path `tenants/{slug}/trip-sheets/{id}.pdf` |
| Schema | `TripSheetDocument`: `pdfStorageKey` + `pdfByteSize`; migrare date noi; opțional backfill script pentru înregistrări existente |
| API | Generare → upload GCS; `GET .../pdf` → signed URL sau stream proxy |
| Securitate | Signed URL scurt (ex. 15 min), tenant check înainte de emitere |
| Env | `GCS_BUCKET`, SA key sau workload identity pe Cloud Run |

**Criterii acceptanță:**

- [ ] PDF nou nu mai scrie în BYTEA
- [ ] Descărcare funcționează pentru viewer și admin
- [ ] Documentație runbook în `api/README.md` (bucket, IAM)

### 3.4 Calitate & operare Q3

| Livrabil | Detaliu |
|----------|---------|
| Teste | e2e: Client CRUD + vehicul legat; trip-sheet generate + download; tenant isolation pe `/clients` |
| Securitate | Eliminare fallback `TenantId` → `'default'` în producție |
| Tech debt mic | Extragere `ops-dates.ts` (parsare date partajată) — opțional dacă atinge fișiere atinse |

**Milestone sfârșit Q3:** **Go-live pilot** pe staging → producție limitată pentru client pilot, cu checklist semnat (dashboard + clienți + FAZ per client).

---

## 4. Q4 2026 (octombrie – decembrie) — CRM minim + mobil

**Obiectiv trimestru:** pilotul poate deschide **tichete simple** legate de flotă și poate lucra **pe telefon** la remindere și vehicule, fără tracking.

### 4.1 Epic: CRM minim

| Livrabil | Detaliu |
|----------|---------|
| Schema | `CrmTicket`: `tenantId`, `clientId`, `subject`, `description`, `status` (`open` \| `in_progress` \| `resolved` \| `cancelled`), `priority`, legături opționale `vehicleId`, `reminderActionId` |
| API | CRUD + listă filtre (client, status, vehicul) |
| Web | Listă + detaliu + formular; link „Deschide tichet” din remindere / vehicul |
| Nav | „Tichete CRM” → **live** |
| Audit | tranziții status |

**Criterii acceptanță:**

- [ ] Flux: reminder overdue → tichet → rezolvat → reminder închis (manual sau ghidat)
- [ ] Filtru tichete per client pilot

**Out of scope Q4:** SLA, email inbound, portal furnizori, automatizări, tipuri ticket configurabile.

### 4.2 Epic: Mobil operațional (liste)

| Livrabil | Detaliu |
|----------|---------|
| Componentă | `FleetResponsiveList` — tabel `lg+`, carduri sub `lg` |
| Pagini pilot | Vehicule, Remindere (apoi opțional documente expirate) |
| UX | Acțiuni principale vizibile pe card (vezi, editează dacă admin) |
| Docs | Actualizare `ui-shell.md` |

**Criterii acceptanță:**

- [ ] Utilizabil pe viewport 390px fără scroll orizontal pe listă
- [ ] Feedback pilot: „pot verifica reminderele în parcărie” (test sesiune 30 min)

### 4.3 Epic: Șoferi (pregătire, nu integrare tahograf)

| Livrabil | Detaliu |
|----------|---------|
| Schema | `Driver` (tenant): `name`, `licenseId?`, `clientId?`, `status` |
| Trip | `driverId` FK opțional; păstrare `driverName` pentru istoric |
| UI | Selector șofer în formular cursă; listă simplă șoferi |

**Notă:** tab Tahograf rămâne placeholder până la integrare hardware / reguli legale clarificate.

### 4.4 Calitate Q4

| Livrabil | Detaliu |
|----------|---------|
| Teste | e2e tichet CRM + legătură reminder; smoke mobil pe CI (Playwright opțional, 1 flux) |
| Refactor | Început împărțire `fleet.service.ts` (vehicule + CIV într-un modul dedicat) dacă atins de Client |

**Milestone sfârșit Q4:** **Retrospectivă pilot** — decizie: extindere la al 2-lea client, sau intrare Phase 1 tracking (Q1 2027).

---

## 5. Ce NU facem în Q3–Q4 (explicit)

- Tracking GPS / hartă live
- Portal furnizori, devize, financiar (facturi)
- Conformitate F2 (vignete, RAR integrat, asistență rutieră)
- i18n EN/DE (UI rămâne RO; copy tehnic poate rămâne mixt de curățat treptat)
- FAZ „pro” / validare legală completă fără consultant
- Pachete comerciale `T+P*` în billing

---

## 6. Mapare meniu Variant C → trimestre

| Item sidebar | Q3 | Q4 |
|--------------|----|----|
| Panou general | live | — |
| Clienți (organizații) | live | — |
| Tichete CRM | F1 (soon) | live |
| Șoferi & utilizatori | — | live (șoferi) |
| Tracking / Hartă | soon | soon |
| Restul Flotă | deja live | + liste mobil |

---

## 7. Metrici trimestriale (pilot)

| Metrică | Țintă Q3 | Țintă Q4 |
|---------|----------|----------|
| Vehicule cu `Client` FK valid | 100% | menținut |
| Sesiuni active / săptămână (tenant pilot) | ≥ 3 | ≥ 5 |
| FAZ lunar generate / lună | ≥ 1 | ≥ 1 |
| Tichete CRM create / lună | — | ≥ 5 |
| Incidente securitate tenant | 0 | 0 |
| Regresii post-deploy (critice) | 0 | 0 |

---

## 8. Ordine recomandată în backlog (sprint-uri)

**Q3 — ordine strictă:**

1. Client schema + API + UI listă/form  
2. Migrare `clientId` pe vehicule + filtre  
3. Dashboard API + pagină  
4. GCS PDF + migrare trip-sheets  
5. Teste e2e + hardening tenant  
6. Go-live pilot  

**Q4 — ordine strictă:**

1. CRM ticket schema + API + UI  
2. Legături reminder ↔ tichet  
3. `FleetResponsiveList` pe vehicule + remindere  
4. Driver entity + trip form  
5. Retrospectivă pilot  

---

## 9. Referințe

- `docs/phase1-mvp-scope.md` — viziune lungă (după pilot)
- `docs/domain-model.md` — țintă canonică (`clientId`, `Job`, `Event`)
- `docs/ui-shell.md` — shell UI
- `docs/service-catalog.md` — module viitoare (F2+)
- `web/src/lib/fleet-nav.ts` — sursă meniu

**Revizuire:** la sfârșitul fiecărui trimestru; ajustare backlog cu feedback client pilot (max 1 pagină note în acest fișier, secțiunea de mai jos).

### Note pilot (de completat)

| Data | Observație | Impact backlog |
|------|------------|----------------|
| | | |
