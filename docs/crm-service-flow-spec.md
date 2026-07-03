# CRM Service Flow — specificație produs & plan progresiv

**Statut:** draft canonic (produs) — bază pentru F5+  
**Data:** 2026-07-03  
**Audiență:** product owner, dezvoltare, pilot FlotaX  
**Referințe:** `identity-access-model.md`, `go-live-pilot-checklist.md`, `domain-model.md`

**Context implementare la data redactării:** F0–F4 live (furnizori, dosar lucrare, programări, devize/cost/factură, Programator). Staging OK, smoke 23/23.

**Ierarhie useri (canonic):** `identity-access-model.md` **§3.5** — L**, L*, L1, L0, profile **F/T/G**, axa **R**.  
**Hartă vizuală în app:** Administrare → **Membri & useri client** → panou dreapta (`UserHierarchyMap`).

---

## 1. Specificația originală (text product owner)

> Strict pentru sistemul de ticheting (tichete CRM / Programator / Devize&comenzi):

### 1.1 Roluri

**1. sofer_alfa** — drepturi limitate:
- deschidere tichet
- acces full la mesageria tichetului
- confirmare programare (împreună cu manager_alfa)
- transformare tichet → cursă
- **rest:** doar vizualizare
- **listă tichete:** doar tichetele create de el + tichetele altor useri pentru mașina(e) pe care le folosește

**2. manager_alfa** — full access ca admin; aprobă devizele; full Devize & comenzi + Programator

**3. Admin (tenant_admin)** — full access

### 1.2 UX tichet

- Persoana **in charge** (owner) vizibilă clar
- **Status** tichet super-vizibil + **schema flux** în interiorul tichetului

### 1.3 Flux operațional

- După **aprobare deviz:** buclă opțională — reparație imediat **sau** reprogramare + reconfirmare
- **Comanda de lucru (WO)** se deschide la **prima confirmare programare** (nu la avansare manuală)
- La **a 2-a programare** nu se creează WO nou — se folosește același WO

### 1.4 Deviz

- Normal: upload de **furnizor**; interim: **manager_alfa + admin**
- Upload **PDF** → parsare automată în linii (manoperă, piese, coduri, valori, sume)
- Alternativ: introducere manuală
- Lipsuri actuale de remediat: subtotaluri/totaluri, cod piesă, export PDF pentru devize manuale, claritate tranziții status WO/deviz

### 1.5 Devize & comenzi (secțiune)

- Infrastructură completă comenzi deschise
- Deviz atașat manual sau via PDF
- Furnizor încarcă **factura** după reparatie
- Listă aliniată stilistic cu CRM Tichete

### 1.6 Legături în stepper (Tichete)

| Etapă stepper | Ce trebuie vizibil |
|---------------|-------------------|
| Comandă service | Nr. comandă (link Devize & comenzi) |
| Deviz | Deviz + accept/respinge |
| Aprobare deviz | acțiuni aprobare |
| (opțional) | a 2-a programare |
| Facturat | factura furnizor |

### 1.7 Comandă de lucru — câmpuri

- Câmpuri operaționale/raportare (ex. **km la service** — lipsește azi)

### 1.8 Viitor

- Modul **call center** (useri dedicati sau integrare)

---

## 2. Mapare roluri țintă ↔ implementare curentă

| Personaj | Nivel L | Rol tehnic azi | Tenant exemplu |
|----------|---------|----------------|----------------|
| Owner vendor | **L\*\*** | (manual / viitor `platform_admin`) | — |
| Admin abonat | **L\*** | `tenant_admin` | `admin@demo.local`, `flotax_admin@flotax.local` |
| Manager client | **L1·full** | `client_user` + `client_admin` | `manager.alpha@demo.local` |
| Șofer | **L0** | `client_user` + `driver` | `sofer.alpha@demo.local` |
| Furnizor | **R\*** / R1 | (viitor) | — |

Profile **F / T / G** pe L* și L1: documentate în IAM §3.5; implementare IAM post-F5a.

| Personaj demo | Rol tehnic azi | Rol țintă spec |
|---------------|----------------|----------------|
| `sofer.alpha@demo.local` | `client_user` + `ClientRole.driver` + portal `driver`/`tickets` | sofer_alfa |
| `manager.alpha@demo.local` | `client_user` + `ClientRole.client_admin` + portal `fleet` | manager_alfa |
| `admin@demo.local` | `MembershipRole.tenant_admin` | admin |

### 2.1 Matrice drepturi — țintă vs. azi

| Capabilitate | sofer_alfa (țintă) | manager_alfa (țintă) | admin (țintă) | Stare azi |
|--------------|---------------------|----------------------|---------------|-----------|
| Creare tichet | ✓ | ✓ | ✓ | ✓ șofer/manager; API OK |
| Mesagerie tichet | ✓ full | ✓ | ✓ | ✓ șofer (comment) |
| Listă tichete scoped | proprii + pe vehicul(e) | toate client | toate tenant | ⚠️ șofer: `createdBy` + `driverId`, **fără vehicul asignat** |
| Transformare → cursă | ✓ | ✓ | ✓ | ✗ șofer blocat în API (`transform`) |
| Confirmare programare | ✓ cu manager | ✓ cu șofer | ✓ | ✗ nu există flux confirmare |
| Programator | vizualizare? | ✓ full | ✓ | manager ✓; șofer ✗ (middleware) |
| Dosar / avans flux | vizualizare | ✓ | ✓ | ✗ doar `tenant_admin` API |
| Devize & comenzi UI | vizualizare pe tichet | ✓ full | ✓ | ✗ manager blocat middleware `/fleet/work-orders` |
| Creare/edit deviz | ✗ | ✓ | ✓ | ✗ doar `tenant_admin` |
| Aprobare deviz | ✗ | ✓ | ✓ | ✗ doar `tenant_admin` |
| Post-cost / factură / închidere WO | ✗ | ✓? | ✓ | ✗ doar `tenant_admin` |

**Decizie de produs (F5a):** manager_alfa face **tot fluxul operațional client-side** (dosar, programare, aprobare deviz). Admin tenant rămâne super-user + configurare. Post-cost/factură: manager **da** pentru pilot (spec: full ca admin pe devize/comenzi).

---

## 3. Analiză punctuală (gap + design)

### Punct 1 — Șofer: drepturi & listă tichete

**Cerință:** create + mesagerie + confirmare programare + transform cursă; rest read-only; listă = `{createdBy = me} ∪ {vehicleId ∈ vehicule mele}`.

**Azi:**
- `ticketListScope` (`client-access.ts`): șofer vede `createdByUserId` sau `driverId` pe tichet — **nu** tichete deschise de alții pe vehiculul asignat fără `driverId`.
- `canPerformTicketAction('transform')`: **false** pentru orice `client_user`.
- Stepper folosește `canWriteTickets` → șofer vede butoane care eșuează la API.

**Design F5a:**
1. Extinde `ticketListScope` / `canReadTicket`: OR `{ vehicleId: { in: assignedVehicleIds } }` când `assignedVehicleIds` non-gol.
2. Permite `transform` pentru șofer pe tichetele vizibile (scoped).
3. Introduce **`canOperateServiceCase`** granular în web (nu reutiliza `canWriteTickets` pentru stepper).
4. Middleware șofer: eventual `/fleet/scheduler` **read-only** pentru confirmări (F5b).

**Acceptanță:** login `sofer.alpha` → listă filtrată corect; transform cursă OK; fără butoane „Avansează dosar”.

---

### Punct 2 — Manager: full access + aprobare devize

**Cerință:** echivalent admin pe tichete, programator, devize & comenzi; el aprobă devizele.

**Azi:**
- Middleware: `/fleet/work-orders` **interzis** pentru `client_user`.
- API: `service-cases` write, `work-order-quotes` write/approve → **`tenant_admin` only**.
- Citire WO: deja permisă `client_user` în controller.

**Design F5a:**
1. Middleware: adaugă `/fleet/work-orders` la `CLIENT_FLEET_PREFIXES`.
2. API: roluri write pe service-cases, quotes, WO complete → `tenant_admin` **sau** `canWriteClientFleet(ctx)` cu scope client.
3. Aprobare deviz: `client_admin` scoped la `clientId` al WO/ticket.
4. Audit: acțiuni manager vs admin distinguishable (`actorUserId` deja există).

**Acceptanță:** `manager.alpha` parcurge smoke flow cap-coadă fără `admin@demo.local`.

---

### Punct 3 — Admin full access

**Azi:** deja satisfăcut pentru flux operațional. Menținem ca referință; fără lucru suplimentar decât aliniere UI.

---

### Punct 4 — Owner + status prominent + schemă în tichet

**Cerință:** owner vizibil; status la vedere; schema flux în pagină.

**Azi:**
- Schema: `CrmTicket.ownerUserId` + relație `owner` — **există**.
- UI `[id]/page.tsx`: afișează status badge mic, **fără owner**; stepper e în coloană laterală, nu hero.

**Design F5b:**
1. **Header tichet** (bandă deasupra conținutului):
   - Status mare + prioritate + routing
   - **Responsabil:** avatar + nume (`owner` sau „Neassignat” + claim)
   - Mini-stepper orizontal (8 etape dosar) sincron cu `ServiceCase`
2. Păstrăm stepper detaliat în sidebar cu acțiuni.

**Acceptanță:** owner + status vizibile fără scroll pe desktop; pe mobile în primele 2 viewport-uri.

---

### Punct 5 — Buclă după aprobare (reparație acum vs reprogramare)

**Cerință:** după `quote.approved`, operator alege:
- **A)** continuă spre execuție (cost/factură) — flux liniar actual
- **B)** **Reprogramează** → programare nouă + reconfirmare → apoi execuție

**Azi:** flux strict liniar `approval → cost → invoiced → closed`; programări multiple posibile în DB dar fără logică de buclă.

**Design F5c:**
1. Etapă nouă sau **sub-stare** `ServiceCase`: `awaiting_repair` vs `reschedule_requested`.
2. După approve quote, UI stepper: două CTA — „Execută acum” / „Programează din nou”.
3. Reprogramare: creează `ServiceAppointment` #2, status `pending_confirmation`, **nu** avansează la WO nou.
4. Eveniment tichet: `workflow_advance` + `appointment_rescheduled`.

**Model date (minim):**
```prisma
// opțional pe ServiceCase
postApprovalPath   PostApprovalPath?  // immediate | reschedule
// pe ServiceAppointment
confirmedAt        DateTime?
confirmedByUserIds String[]  // JSON sau join table — F5c simplu: managerConfirmedAt + driverConfirmedAt
```

**Acceptanță:** smoke path cu ramura B; dosar rămâne un singur WO.

---

### Punct 6 — WO la prima confirmare programare (nu la advance manual)

**Cerință:** WO creat când programarea e **confirmată**; a 2-a programare refolosește WO.

**Azi:** `ensureWorkOrder` în `advance()` când `targetStage === work_order`. Programările pot exista fără WO.

**Design F5c (breaking change controlată):**
1. Mută `ensureWorkOrder` în handler **confirm appointment** (prima confirmare pentru dosar).
2. `advance` spre `work_order` devine **automát** sau idempotent dacă WO există.
3. Regula: `findFirst({ serviceCaseId })` — deja implementată în `ensureWorkOrder` ✓
4. Reordonează etape UX: `scheduled` = programare propusă → confirmată → WO apare.

**Migrare pilot:** dosare existente cu WO rămân valide; noi dosare urmează regula nouă.

**Acceptanță:** prima confirmare → WO `draft`/`sent`; confirmare #2 → același `wo.id`.

---

### Punct 7 — Confirmare programare (șofer + manager)

**Cerință:** amândoi participă la confirmare.

**Azi:** programare = create appointment, fără workflow confirmare.

**Design F5b (MVP) → F5c (complet):**

| Fază | Comportament |
|------|--------------|
| **F5b MVP** | Status appointment: `proposed` → `confirmed` când **manager** confirmă; șofer primește notificare + buton „Am luat la cunoștință” (ack, nu gate) |
| **F5c** | Gate: WO creat doar când **ambele** flag-uri setate |

**UI:** card programare în stepper + Programator; badge „Așteaptă confirmare șofer/manager”.

---

### Punct 8 — Deviz: upload PDF + parsare automată

**Cerință:** PDF → linii structurate; interim uploader = manager + admin; viitor furnizor.

**Azi:** doar linii manuale; upload documente există pentru module Documente (pattern reutilizabil).

**Design F5d (manual first) → F5e (PDF):**

**F5d — enrichment manual (prioritar pilot):**
- `WorkOrderQuoteLine`: `partCode`, `lineType` (labor/part/sublet)
- Agregate: subtotal net, TVA, total — calculate server-side
- `GET /quotes/:id/pdf` — generare PDF din linii (pdfkit, ca FAZ/trip sheets)

**F5e — import PDF:**
1. Upload → stocare (GCS când migrăm; interim disc container ca documente)
2. Pipeline: extract text (pdf-parse) → LLM/regex template per furnizor (Alpha Service, etc.)
3. UI **review table** — utilizator confirmă/editează înainte de save
4. `WorkOrderQuote.sourcePdfUrl`, `parseStatus: pending|review|applied|failed`

**Risc:** parsare 100% automată nerealistă pilot — **human-in-the-loop obligatoriu**.

---

### Punct 9 — Devize & comenzi: infrastructură completă

**Cerință:** inbox comenzi deschise, detalii, deviz, factură furnizor.

**Azi:** listă `/fleet/work-orders`, detail + `WorkOrderQuotePanel`, record invoice API există — **dar** listă simplă, fără stil CRM, fără upload factură PDF.

**Design F5d:**
1. Refactor listă: același layout ca `/fleet/tickets` (`FleetListPageLayout`, KPI strip, filtre, export)
2. Detail: tab-uri Overview / Deviz / Programări / Factură / Istoric
3. Factură: upload PDF + nr + dată (extinde `record-invoice` cu `invoiceFileUrl`)
4. Legătură bidirecțională ticket ↔ WO (deja `CrmTicketLink`)

---

### Punct 10 — Stepper cross-links (WO, deviz, aprobare, factură)

**Cerință:** sub fiecare etapă, entitatea concretă + acțiuni.

**Azi:** listă WO link-uri; **fără** deviz inline, fără approve/reject în stepper, fără factură.

**Design F5b (paralel cu F5a):**
1. Fetch quote summary în `by-ticket` payload (evită N+1)
2. Componente noi în stepper:
   - `WorkOrderStepCard` — nr. intern, status badge, link
   - `QuoteStepCard` — total, status, Approve/Reject (dacă `canApproveQuote`)
   - `InvoiceStepCard` — nr, dată, link PDF
   - `RescheduleStepCard` — după F5c

---

### Punct 11 — Câmpuri WO (km, etc.)

**Azi:** `MaintenanceWorkOrder`: title, status, supplierId, plannedAt, completedAt — **fără** odometer.

**Design F5d schema:**
```prisma
model MaintenanceWorkOrder {
  // ...
  odometerKmIn   Int?
  odometerKmOut  Int?
  estimatedDurationMin Int?
  internalNotes  String?
  displayNumber  String?  // human WO-2026-001 — generat la create
}
```

**displayNumber** afișat în stepper („Comandă #WO-…”) — cerință explicită product owner.

---

### Punct 12 — Status WO & deviz — claritate

**Azi:**

| Entitate | Statusuri | Tranziții |
|----------|-----------|-----------|
| **WO** | draft, sent, in_progress, waiting_parts, done, cancelled | implicit prin complete; puțin expus în UI |
| **Quote** | draft → submitted → approved/rejected | API strict; UI butoane în panel |

**Design F5d:**
1. Documentează în UI tooltip/help lângă badge
2. Automatizări:
   - quote `submitted` → WO `sent` (optional)
   - quote `approved` → WO `in_progress`
   - `record_invoice` → WO rămâne `in_progress` până `complete`
3. Diagramă mică în pagina WO detail

---

### Punct 13 — Listă Devize & comenzi stil CRM Tichete

**Azi:** tabel funcțional, fără glyph-uri, owner, SLA, sau grouping.

**Design F5d:** reutilizează componente tickets (`FleetDataTable`, avatare client/vehicul, quick filters „Deschise / Așteaptă aprobare / Facturate”).

---

### Punct 14 — Call center (viitor)

**Out of scope F5.** Pregătire:
- Rol `call_center_agent` (tenant sau client scoped)
- Tichete create telefonic cu `sourceChannel: phone`
- Integrare CTI (Twist, etc.) — fază separată 2026 Q4+

**Notă IAM:** nu contrazice `identity-access-model.md` — strat 4 extins.

---

## 4. Plan progresiv de livrare

Principii:
- Fiecare fază = deployabil + test smoke
- RBAC înainte de UX — evită butoane moarte
- PDF parsing după structura datelor stabile
- Nu refactoriza tot stepper-ul odată

```
F5a ──► F5b ──► F5c ──► F5d ──► F5e ──► F6 (call center)
 │        │        │        │
 RBAC    UX       Flux     Deviz/WO
 align   tichet   confirm  enrichment
         links    + loop
```

### F5a — Aliniere RBAC & acces (1 sprint, fundație)

| # | Livrabil | Fișiere / zone |
|---|----------|----------------|
| 1 | Manager: write service-cases, quotes, WO complete | `service-cases.controller`, `work-order-quotes.controller`, `work-orders.controller` |
| 2 | Scope enforcement pe `clientId` | services existente + `assertClientFleetWrite` |
| 3 | Middleware `/fleet/work-orders` pentru portal fleet | `web/src/middleware.ts` |
| 4 | Șofer: ticket scope vehicul + transform cursă | `client-access.ts`, tickets service |
| 5 | Web: permisiuni granulare stepper | `auth-server.ts`, `TicketWorkflowStepper` |
| 6 | Smoke: `--write` cu `manager.alpha` token | `smoke-staging-service-flow.mjs` |

**Exit:** manager parcurge flux complet; șofer nu vede acțiuni admin; zero 403 surpriză în UI.

---

### F5b — UX tichet & stepper bogat (1 sprint)

| # | Livrabil |
|---|----------|
| 1 | Header: owner + status + mini-stepper |
| 2 | Stepper: card WO cu displayNumber |
| 3 | Stepper: card deviz + approve/reject inline |
| 4 | Stepper: card factură când există |
| 5 | Confirmare programare MVP (manager confirmă) |
| 6 | API: extend `GET service-cases/by-ticket` cu quote + invoice summary |

**Exit:** product owner validează pe staging un tichet cap-coadă doar din pagina tichet (fără navigare separată WO).

---

### F5c — Flux confirmare & buclă reprogramare (1–1.5 sprint)

| # | Livrabil |
|---|----------|
| 1 | Appointment: status + confirm endpoints |
| 2 | WO creat la prima confirmare |
| 3 | Post-approval branch UI |
| 4 | A 2-a programare fără WO duplicat |
| 5 | Confirmare duală șofer+manager (gate WO) |
| 6 | Actualizare smoke + checklist §5.x |

**Exit:** scenarii A și B din §3 punct 5 trec smoke.

---

### F5d — Deviz & WO profesional (1.5 sprint)

| # | Livrabil |
|---|----------|
| 1 | Migrare: partCode, totals, WO odometer, displayNumber |
| 2 | Quote panel: subtotaluri, cod piesă |
| 3 | Export PDF deviz manual |
| 4 | Listă work-orders redesign CRM |
| 5 | WO detail: câmpuri noi + ghid status |
| 6 | Upload factură PDF (manager/admin) |

**Exit:** deviz manual complet (cod, totaluri, PDF out); listă WO la nivel pilot FlotaX.

---

### F5e — Import PDF deviz (1–2 sprint, risc mediu)

| # | Livrabil |
|---|----------|
| 1 | Upload PDF pe quote |
| 2 | Extract + draft lines |
| 3 | UI review & apply |
| 4 | Template configurabil per supplier (start 1 furnizor pilot) |

**Exit:** 1 PDF real de la furnizor pilot → linii corecte cu ≤5 min edit manual.

---

### F6 — Furnizor portal + call center (backlog)

- Portal furnizor: upload deviz, confirmare programare, factură
- Rol call center, telefonie — după stabilizare F5

---

## 5. Dependențe & riscuri

| Risc | Mitigare |
|------|----------|
| UI arată acțiuni dar API refuză | **F5a primul** — niciodată invers |
| Parsare PDF eșuează | review obligatoriu; manual fallback |
| Schimbare moment creare WO | migrare soft; idempotent `ensureWorkOrder` |
| Fișiere staging pierdute la redeploy | plan GCS (deja notat pentru documente) |
| manager = admin complet | audit clar; eventuale limite viitoare (ex. ștergere tenant) |

---

## 6. Criterii pilot FlotaX (definition of done F5)

1. **manager.alpha** deschide tichet → programare → confirmă → WO apare → deviz manual → **aprobă** → cost/factură → închide — fără admin
2. **sofer.alpha** deschide tichet, chat, confirmă programare, transformă în cursă, **nu** editează deviz
3. Pagina tichet arată owner, status, nr. WO, deviz, factură în stepper
4. Reprogramare după aprobare funcționează fără WO duplicat
5. Deviz are totaluri + export PDF
6. Checklist go-live actualizat + smoke verde

---

## 7. Ordine recomandată de start

**Săptămâna 1:** F5a (RBAC + middleware + scope șofer)  
**Săptămâna 2:** F5b (UX tichet + cross-links + confirmare MVP)  
**Săptămâna 3–4:** F5c (flux confirmare + buclă)  
**Săptămâna 5–6:** F5d (deviz/WO enrichment + listă CRM)  
**După pilot stabil:** F5e PDF import

---

## 8. Legătură checklist go-live

La finalul fiecărei faze, adaugă secțiune în `go-live-pilot-checklist.md`:

- **§5.1** F5a RBAC manager/șofer
- **§5.2** F5b UX tichet
- **§5.3** F5c confirmare & buclă
- **§5.4** F5d deviz/WO
- **§5.5** F5e PDF import

---

*Document generat din specificația product owner (2026-07-03). Actualizează la schimbări de scope.*
