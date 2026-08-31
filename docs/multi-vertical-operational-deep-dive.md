# Deep-dive operațional multi-vertical — finețe, maturitate, viitor

**Statut:** companion canonic la [`multi-vertical-fleet-architecture.md`](multi-vertical-fleet-architecture.md) (v1.1)  
**Dată:** 2026-08-14  
**Scop:** detalii de **superfinețe operațională**, mapare pe ce există deja în Fleet Enterprise, ce se poate dezvolta din nucleu, și ce se poate conecta pe orizont 2–5 ani — la nivel de software de specialitate (LO RO, DMS, RMS, tyre/claims).  
**Regulă:** un VIN = un `Vehicle`; modulele = ocupări + playbook-uri, nu silozuri de date.

---

## A. Cum se citește acest document

| Strat | Întrebare | Unde |
|-------|-----------|------|
| **L0 Nucleu** | Ce e deja / trebuie să rămână comun? | §B |
| **L1 Verticală** | Ce face fiecare modul „ca un profesionist”? | §C–E |
| **L2 Servicii transversale** | Anvelope, asigurări, taxe, combustibil, daune… | §F |
| **L3 Intersecții** | Cum se împrumută stocul între verticale? | §G |
| **L4 Maturitate** | MVP → operațional → excelență | §H |
| **L5 Viitor / conexiuni** | Ce crește din asta? | §I–J |
| **L6 Catalog capabilități** | Checklist de implementare | §K |

---

## B. Nucleu comun — „sistemul nervos” (CORE+)

Tot ce construim pe verticale trebuie să se sprijine pe aceste **capacități transversale**. Multe există deja ca schelet; finețea = să le facem **contract-aware** și **allocation-aware**.

### B.1 Identitate asset (deja puternică — diferențiator RO)

| Capacitate | Stare | Finețe țintă |
|------------|-------|--------------|
| VIN + CIV OCR (2016/1993) | în lucru | profil tehnic de încredere = bază pricing LO, listing parc, clasă rent |
| Documente + expirări | există | **pachete de conformitate** pe verticală (ex. rent = RCA+talon+ITP obligatoriu înainte de `Available`) |
| Foto / media | parțial | inspecții predare/retur, merchandising parc, daune |
| Odometru | există | sursă unică pentru excess km LO, rent close, tyre CPK |

**Premiză:** fără CIV/docs stabile, verticale precum PARK (import) și LEASE (livrare) rămân fragile. De aceea F0 = CIV.

### B.2 Service spine (deja + CRM)

Mentenanța, work orders, costuri, ticket CRM = **motorul** pentru:

- recondiționare parc  
- full-service LO  
- turnaround / daune rent  
- downtime + mașină înlocuitoare  

Finețe: fiecare WO trebuie să poată răspunde la:

1. **Cine plătește?** (inclus în LO / client fleet / casă / asigurător / șofer)  
2. **Blochează availability?** (da → `service_block` pe Allocation)  
3. **Generează factură / claim?** (eveniment spre Finance / Insurance)

### B.3 Allocation engine (de construit — cheia multi-verticală)

```
VehicleAllocation {
  kind: park_stock | lease | rent | fleet_assignment | service_block | prep | transport | loaner
  priority: number          // cine câștigă conflictul
  exclusive: boolean        // hard lock pe interval
  policyRef?: string        // reguli tenant
}
```

**Reguli de conflict (exemple configurabile):**

| Situație | Rezolvare default |
|----------|-------------------|
| Lease activ + rezervare rent | **refuz** |
| Prep parc + listing online | listing `draft` până `ON_LOT` |
| Service block + rent reserved | **re-allocate** sau postpone pickup |
| Loaner pentru LO downtime | rent pool cu flag `loaner_eligible` |

### B.4 Event bus intern (premiză integrări)

Orice acțiune ops emite eveniment canonic (aliniat la `integration-strategy.md`):

`vehicle.status_changed` · `allocation.opened/closed` · `document.expiring` · `wo.completed` · `inspection.signed` · `invoice.posted` · `claim.opened` · `tyre.mounted` · `fuel.txn` · `fine.received`

Aceste evenimente = **robinetele** spre ERP, BI, portal client, asigurători.

---

## C. Modul PARK_DEALER — finețe de tip DMS

Inspirație: CDK Vehicle Inventory / Dealership Xperience, Reynolds, Dealertrack + fluxuri RO (DITL, RAR, DRPCIV, CIV).

### C.1 Pipeline stoc — stări + checklist-uri (nu doar status string)

| Stare | Intrare | Ieșire | Artefacte obligatorii | Blochează |
|-------|---------|--------|----------------------|-----------|
| `SOURCED` | lead / licitație / trade-in / import quote | decizie buy | sursă, preț țintă | — |
| `APPRAISED` | inspecție + estimate recon | aprobare cumpărare | `ReconEstimate` pe linii | — |
| `PURCHASED` | PO / factură | plată / transport | `StockAcquisition`, cost achiziție | — |
| `IN_TRANSIT` | CMR / booking | recepție yard | ETA, carrier | — |
| `IMPORT_CUSTOMS` | dosar vamă | liber | docs vamă | vânzare |
| `DITL_PENDING` | job document_flow | chitanță/impunere | ticket DITL | înmatriculare |
| `CIV_PENDING` | scan + OCR | CIV valid | `VehicleDocument` CIV | înmatriculare |
| `REG_PENDING` | dosar DRPCIV | talon + nr. | talon | `ON_LOT` public |
| `IN_YARD` | recepție fizică | start recon | locație, chei, foto intake | — |
| `RECON` | WO-uri | QC pass | cost recon vs estimate | listing public |
| `DETAIL_PREP` | detailing | foto set | media package | — |
| `ON_LOT` | pricing + listing | rezervare/vânzare | preț listă, aging clock | — |
| `RESERVED` | deposit / hold | deal sau release | hold expiry | alt buyer |
| `IN_DEAL` | SalesDeal | livrare | contract, plată | — |
| `DELIVERED` | checklist predare | aftersales opțional | PV predare | — |
| `AFTERSALES` | garanție / service | closed | ticket | — |

**Aging clock** pornește la `PURCHASED` sau `IN_YARD` (config tenant). Bucket-e: 0–30 / 31–60 / 61–90 / 90+ cu alerte manager.

### C.2 Capabilități de finețe (ce face un DMS bun)

1. **Appraisal / trade-in** — scor stare, estimate recon linie-cu-linie **înainte** de a cumpăra (protejează marja).  
2. **Floorplan / cost capital** — cost zilnic deținere stoc (opțional; legat Finance).  
3. **Merchandising** — foto standardizate, descriere listing, syndication către site/OLX/Autovit (conector).  
4. **Market pricing assist** — input manual + eventual feed piață (fază târzie); nu inventăm preț, dar structurăm disciplina.  
5. **Multi-yard / multi-rooftop** — locații, transferuri între parcuri.  
6. **Chei / documente fizice** — tracking „unde e CIV-ul / unde sunt cheile”.  
7. **Loaner / demo** — unități pe lot pot ieși temporar în RENT fără a părăsi ownership parc.  
8. **Pack-uri pregătire vânzare** — template-uri WO pe tip vehicul (turism vs LCV).  
9. **Remarketing din LO** — intake automat la EOC → pipeline parc (vezi §G).  
10. **F&I light (comercial viitor)** — credit, asigurare vânzare, pachete — **slot rezervat**, nu MVP.

### C.3 KPI parc (tablou manager)

| KPI | De ce contează |
|-----|----------------|
| Days in inventory (medie / P90) | capital blocat |
| Recon cost vs estimate | disciplină cumpărare |
| Gross / net per unit | marjă reală |
| % stoc fără CIV/talon | risc operațional RO |
| Time-to-online (yard → listing) | viteză vânzare |
| Turn rate | sănătate stoc |

### C.4 Roluri tipice parc

Yard manager · Recon advisor · Documentalist (DITL/CIV/DRPCIV) · Sales advisor · Delivery coordinator · Inventory controller

---

## D. Modul LEASE_OPS — finețe full-service (model RO)

Inspirație: Ayvens/Alphabet, Sixt Leasing, Business Lease, Everest Fleet, Edocti, Charisma, Asseco LEO, Moiboo, FleetFabric FML.

### D.1 Anatomia produsului LO (configurabil pe `LeaseProduct`)

| Componentă pachet | Inclus? | Motor în platformă |
|-------------------|---------|-------------------|
| Finanțare / rată asset | da | Finance Hub recurring |
| Mentenanță preventivă + corectivă | da/opțional | Maintenance + autorizări |
| ITP | da | Documents + WO |
| Anvelope (vară/iarnă, depozit, echilibrare) | da/opțional | **Tyre Hub** §F.1 |
| RCA + CASCO | da/opțional | Insurance Hub §F.2 |
| Rovinietă / taxe drum | da/opțional | Toll / vignette jobs |
| Impozit auto / DITL anual | da/opțional | Document flows |
| Asistență rutieră 24/7 | da/opțional | CRM + partner API |
| Vehicul înlocuitor (downtime) | da/opțional | Allocation `loaner` din RENT/PARK |
| Fuel card admin | opțional | Fuel Hub §F.3 |
| Gestionare amenzi | opțional | Fines Hub §F.4 |
| Pickup/delivery la service | opțional | Job logistics |
| Portal client + șofer | opțional | Client portal |
| Raport TCO / ESG | opțional | Analytics |

**Regulă comercială:** fiecare componentă = **ServiceLine pe contract** cu: inclus / cap / excess billable / excluded.

### D.2 Lifecycle contract — evenimente fine

```
Lead → Needs analysis → Quote (TCO)
  → Credit/Approval (opțional / integrare bancă)
  → Contract draft → e-sign → Active
  → Vehicle bind (din PARK sau order-to-OEM)
  → Delivery ceremony (checklist + foto + semnătură)
  → In-life:
       |-- preventive schedule
       |-- reactive WO + authorization matrix
       |-- tyre season campaigns
       |-- insurance renewals
       |-- mileage capture (portal/telematics/invoice)
       |-- amendments (durată, km, șofer, upgrade)
       |-- early termination request
  → End-of-contract:
       |-- return booking
       |-- inspection vs fair wear & tear matrix
       |-- excess km / damage invoice
       |-- asset release → PARK remarketing | extend | buyout
```

### D.3 Matrice autorizări service (finețe critică LO)

| Tip lucrare | Autorizare | Plătitor default |
|-------------|------------|------------------|
| Revizie conform plan | auto-approve în plafon | contract (inclus) |
| Reparație neprevăzută < X RON | fleet desk | contract |
| Reparație > X RON | manager + foto | contract / split |
| Daună CASCO | claim flow | asigurător → eventual excess client |
| Uzură anormală | contestabil | client |
| Tuning / neautorizat | refuz / client 100% | client |

Fără această matrice, LO pierde bani silențios (revenue leakage).

### D.4 Mileage & excess

- Surse: telematics, facturi service, self-report șofer, citire la control.  
- Politică: lunar / trimestrial / EOC.  
- Billing: prag inclus → tarif /km → factură ad-hoc.  
- Alertă precoce la 80% din km contractual.

### D.5 Downtime & replacement (ca Alphabet)

1. Ticket `downtime` + cauză (service / daună / furt).  
2. SLA: timp până la loaner.  
3. Allocation din pool `loaner_eligible`.  
4. Cost loaner: inclus / facturat / din marja LO.  
5. Închidere: return loaner + resume asset principal.

### D.6 KPI LO

Contract margin (rată − costuri reale) · TCO per unit · Downtime hours · % WO in-network · Tyre cost/km · Claims cycle time · EOC recovery (damage+excess) · Residual vs remarketing price

### D.7 Portaluri

| Portal | Utilizator | Acțiuni |
|--------|------------|---------|
| Client fleet manager | client org | flota, costuri, aprobări, rapoarte |
| Șofer | end user | programare service, FNOL, documente |
| Dealer/service network | furnizor | WO status, autorizare, factură |
| Sales LO | intern | oferte, pipeline |

---

## E. Modul RENT_CAR — finețe RMS

Inspirație: Rental Car Manager, Wheels RMS, Europcar Opticar (yield), LendControl turnaround, AI damage inspection trends.

### E.1 Motor de disponibilitate (inima rent)

**Inputuri:**

- clasă / model / locație  
- interval rezervare  
- turnaround buffer (ex. 90–120 min)  
- block-outs: service, prep, relocation, admin lock  
- one-way / inter-branch rules  
- overbooking policy (0% MVP; controlat mai târziu)

**Output:** listă unități eligibile + scor **best-fit** la pickup (odometru, curățenie, proximitate, uzură, „preferă unitatea care egalează aging”).

### E.2 Stări vehicul rent (mai fine decât available/rented)

`Available` → `Reserved` → `Out` → `Returning` → `Turnaround` → `Available`  
Ramuri: `Maintenance` · `Damaged` · `Overdue` · `AdminHold` · `Relocation`

### E.3 Turnaround playbook (60–90 min țintă)

1. Check-in inspecție (foto 360, combustibil, km, accesorii)  
2. Comparație cu baseline pickup → **delta damages**  
3. Curățenie interior / exterior  
4. Alimentare  
5. Spot check (anvelope, lumini, lichide)  
6. Status `Available` **imediat** (nu la final de zi)

Finețe: turnaround = **Job** cu SLA + checklist template + assignment yard staff.

### E.4 Contract & risk

- Depozit / pre-auth card  
- Franchise daune / CDW / Super CDW  
- Șoferi suplimentari, vârstă minimă, permis  
- Extindere / late return fees  
- One-way fee  
- Cross-border rules  

### E.5 Yield & revenue (orizont 2 — slot rezervat)

Nu e MVP, dar arhitectura trebuie să suporte:

- rate seasons / DOW / lead-time  
- length-of-rental discounts  
- competitor rate input (manual)  
- forecast demand → sugestii relocare / achiziție  

(Europcar Opticar = dovada că yield + capacity sunt „superliga”; noi lăsăm **RatePlan + DemandSignal** extensibile.)

### E.6 Canale rezervare

Counter · Web booking widget · API broker/OTA · Corporate account · App șofer flotă (motor pool)

Fiecare canal = `BookingSource` cu comision și reguli stoc.

### E.7 KPI rent

Utilization % · RPU (revenue per unit) · RevPAC · Turnaround time median · Damage recovery rate · No-show % · Fleet aging mix · Idle days after return

---

## F. Servicii transversale „de excelență” (shared hubs)

Acestea **nu** sunt verticale separate de vânzare neapărat — sunt **add-on SKU** sau incluse în LO. Pot fi activate independent pe tenant.

### F.1 Tyre Hub (anvelope)

Din practică LO RO (Sixt/Ayvens) + softuri tyre (TyreOps, eFleetAdmin, FleetStack):

| Capacitate | Detaliu |
|------------|---------|
| Identitate anvelopă | DOT / serial, dimensiune, brand |
| Stare | mounted (poziție axă) / stock / storage seasonal / repair / scrap |
| Sezoane | campanii schimb vară↔iarnă pe flotă/contract |
| Depozitare | locație, cost storage, legătură contract |
| CPK | cost / km pe anvelopă |
| WO legătură | montaj = maintenance line |
| Warranty claims | pe furnizor |

**Conectare:** LEASE (inclus), FLEET (add-on), RENT (uzură rapidă), PARK (prep).

### F.2 Insurance & Claims Hub

| Capacitate | Detaliu |
|------------|---------|
| Polițe | RCA/CASCO pe vehicul, perioadă, broker |
| FNOL | first notice of loss din portal/app |
| Dosar daună | foto, constatare, status asigurător |
| Excess / franchise | facturare client |
| Total loss | → decommission / replace flow |
| Reînnoiri | remindere + cost pe contract LO |

### F.3 Fuel Hub

Carduri combustibil, import tranzacții, reconciliere odometru, anomalii (litri vs km), cost pe client/contract. Conectori: DKV, Mol, Rompetrol, etc. (robinete inbound).

### F.4 Fines & Toll Hub

Amenzi (radar, parcare) → identificare șofer/client → notificare → facturare / reținere din depozit rent. Rovinietă / eToll / eTransport ca jobs + costuri (deja în service-catalog Phase 2).

### F.5 Compliance RO Hub (avantaj competitiv)

Catalog existent RAR / DITL / DRPCIV / CIV → **workflow engine** pe stări, cu SLA, documente, responsabili.  
Folosit intens de PARK (intrare stoc) și LEASE (livrare + anual).

### F.6 Parts & Vendor network

Rețea service autorizată, tarife negociate, SLA, scorecard furnizor — esențial LO „in-network”.

---

## G. Intersecții operaționale (unde se face banul + complexitatea)

### G.1 Playbook-uri cross-module

| # | Playbook | Flux |
|---|----------|------|
| P1 | **Sourcing LO din parc** | `ON_LOT` → bind LeaseContract → `ON_LEASE` → delist |
| P2 | **Remarketing EOC** | return inspect → RECON → ON_LOT → SalesDeal |
| P3 | **Downtime loaner** | lease downtime → rent allocation loaner → return |
| P4 | **Demo/rent pe stoc parc** | ON_LOT unit → temporary RENT → back ON_LOT |
| P5 | **Fleet client pe LO** | LeaseContract active → vehicule vizibile în FLEET_MGMT client |
| P6 | **Service block global** | orice verticală → allocation service_block → calendars update |
| P7 | **Buyout LO** | client cumpără → SalesDeal intern → asset exit sau transfer ownership |
| P8 | **Import → parc → lease** | CIV/DITL/REG → ON_LOT → P1 |

### G.2 Diagrama de dependență „tare” vs „moale”

```
CORE (obligatoriu)
 ├── FLEET_MGMT
 ├── PARK_DEALER
 │     └── soft-dep: FIN_OPS, COMPLIANCE_RO, TYRE (prep)
 ├── RENT_CAR
 │     └── soft-dep: FIN_OPS, TYRE, INSURANCE
 ├── LEASE_OPS
 │     ├── hard-recomandat: PARK (sourcing/remarketing)
 │     ├── hard-recomandat: FIN_OPS
 │     └── soft: RENT (loaner), TYRE, INSURANCE, FUEL, FINES
 └── FIN_OPS / API / Hubs
```

### G.3 Regula anti-haos

Orice transfer între verticale trece prin:

1. închiderea allocation curente  
2. checklist stare (inspecție)  
3. deschiderea allocation noi  
4. eveniment pe bus  
5. (opțional) mișcare financiarǎ (transfer cost center)

---

## H. Maturitate pe nivele (ce înseamnă „cel mai bun”)

| Nivel | PARK | LEASE | RENT | Shared |
|-------|------|-------|------|--------|
| **M1 MVP** | pipeline stări + cost + listing intern | contract + bind vehicle + billing rată | rezervare + contract + pickup/return | docs + maintenance |
| **M2 Operațional** | recon estimate, aging, multi-yard, DITL/CIV jobs | service matrix, tyre seasons, downtime loaner, EOC inspect | availability engine, turnaround SLA, deposits | claims light, fuel import |
| **M3 Competitiv** | merchandising + syndication, appraisal | portal client/șofer, TCO dashboards, network scorecards | multi-channel API, damage photo baseline | Tyre CPK, fines routing |
| **M4 Excelență** | market pricing assist, F&I | IFRS notes, credit integration, ESG | yield/forecast, AI damage | sub-ledger, e-Factura, telematics closed-loop |

**Țintă realistă 18 luni:** M2 pe PARK + RENT, M2 pe LEASE dacă parc există; M3 pe hubs treptat.

---

## I. Ce se poate dezvolta **din** această fundație (arbore de produs)

### I.1 Extensii naturale (același Asset Pool)

| Produs | Descriere | Pe ce se bazează |
|--------|-----------|------------------|
| **Motor pool corporativ** | rezervări interne angajați | RENT engine fără yield |
| **Subscription auto / flex LO** | LO pe 1–6 luni, anulare după luna 1 (tip Ayvens Flex) | LEASE + RENT hybrid |
| **Remarketing as a service** | vinzi stocul altora | PARK pipeline |
| **White-label dealer OS** | SaaS doar PARK+FIN | entitlements |
| **White-label rent OS** | SaaS RENT+API booking | entitlements |
| **Fleet-as-a-Service operator** | voi operați flota clientului | FLEET + service catalog |
| **EV readiness** | baterie SOH, încărcare, home charger assets | Vehicle + Aggregate + energy events |
| **LCV / utilitare / remorci** | deja în domain model | assemblies, agregate |
| **Driver lifecycle** | permis, fișe, training, amenzi | identity + fines |
| **Warranty & recall OEM** | campanii pe VIN | Vehicle + WO |

### I.2 Strat comercial (lăsat intenționat „robinet”)

- Catalog SKU module (§7 arhitectură)  
- Metering: vehicule active, contracte LO, rezerve/lună, pagini OCR  
- Partner marketplace: service, tyre, insurance brokers  
- Franchise rent multi-locație  
- Reseller / MSP: un tenant părinte administrează flote copii  

### I.3 Strat date / AI (după volum)

- Predicție defecte din istoric WO + telematics  
- Predicție preț remarketing  
- Detecție daune din foto (assist, nu autonomie totală)  
- Optimizare mix stoc rent (ce clase să cumperi)  
- Anomalie combustibil / fraudă  

---

## J. Conexiuni viitoare — harta de integrări extinsă

Completează `integration-strategy.md` cu verticalele noi.

### J.1 Outbound (noi = sursă de adevăr ops)

| Dominiu | Evenimente / API | Consumator tipic |
|---------|------------------|------------------|
| Contabilitate RO | `invoice.*`, `cost.posted` | Oblio, Saga, WinMentor, Nexus, Charisma |
| ERP grup | asset register, AP/AR | SAP, Oracle, Microsoft BC |
| e-Factura / SPV | facturi emise | ANAF (fază reglementară) |
| Website dealer | `listing.upserted` | site propriu, Autovit/OLX connectors |
| Booking engines | availability + rates | widget, OTA, brokeri |
| BI / data lake | CDC sau webhooks | Metabase, Power BI, BigQuery |
| Asigurători / brokeri | FNOL, policy renew | API broker |
| Bănci / credit | lease application | scoring |
| OEM / parts | VIN options, recalls | catalog piese (ex. Inter Cars — ulterior) |
| Telematics | deja planificat | GPS, odometer truth |
| Semnătură electronică | contracte LO/rent/sale | DocuSign / local e-sign |
| Plăți | depozite, rate | Stripe / netopia / bancă |

### J.2 Inbound

Fuel cards · telematics · service dealer invoices · traffic fine providers · customs/import feeds · lead forms (Meta/Google) · accounting payment status · OTA bookings

### J.3 Design „robinet” (cerință ta — obligatoriu)

Pentru **fiecare** agregat de date important:

1. **REST read** stabil (`/v1/...`)  
2. **Webhook** semnat HMAC  
3. **Export job** CSV/JSON programat  
4. **Idempotent write** unde e cazul (ex. create reservation)  
5. **Partner sandbox**  

SKU `API` plătit = monetizare + control rate-limit.

---

## K. Catalog capabilități — prioritate de implementare

Legendă: **P0** fundație · **P1** MVP verticală · **P2** operațional · **P3** excelență · **C** comercial viitor

### K.1 Fundație

| ID | Capabilitate | P |
|----|--------------|---|
| F-01 | CIV OCR stabil (2016+1993) | P0 |
| F-02 | VehicleAllocation + conflict rules | P0 |
| F-03 | Entitlements pe module | P0 |
| F-04 | Event bus + webhook skeleton | P0 |
| F-05 | Finance Hub A (invoice + export) | P1 |
| F-06 | Compliance jobs DITL/RAR/DRPCIV | P1 |

### K.2 PARK

| ID | Capabilitate | P |
|----|--------------|---|
| PK-01 | Pipeline stări + checklist | P1 |
| PK-02 | StockAcquisition + costs | P1 |
| PK-03 | Yard location + keys/docs tracking | P1 |
| PK-04 | Recon WO pack + estimate | P2 |
| PK-05 | Listing + aging KPI | P2 |
| PK-06 | SalesDeal + delivery PV | P2 |
| PK-07 | Appraisal / trade-in | P3 |
| PK-08 | Syndication portaluri anunțuri | P3 |
| PK-09 | F&I light | C |

### K.3 LEASE

| ID | Capabilitate | P |
|----|--------------|---|
| LO-01 | LeaseProduct + Quote + Contract | P1 |
| LO-02 | Vehicle bind + delivery | P1 |
| LO-03 | Recurring billing | P1 |
| LO-04 | Service authorization matrix | P2 |
| LO-05 | Tyre seasonal campaigns | P2 |
| LO-06 | Downtime + loaner | P2 |
| LO-07 | Mileage excess | P2 |
| LO-08 | EOC inspection + recovery | P2 |
| LO-09 | Client/driver portals | P3 |
| LO-10 | Credit/approval integration | C |
| LO-11 | IFRS / residual analytics | C |

### K.4 RENT

| ID | Capabilitate | P |
|----|--------------|---|
| RT-01 | RatePlan + Reservation | P1 |
| RT-02 | Agreement pickup/return | P1 |
| RT-03 | Availability engine + turnaround | P2 |
| RT-04 | Deposit + extras billing | P2 |
| RT-05 | Damage delta vs baseline | P2 |
| RT-06 | Multi-location + relocation | P3 |
| RT-07 | OTA/API channels | P3 |
| RT-08 | Yield / forecast | C |
| RT-09 | AI damage assist | C |

### K.5 Hubs

| ID | Capabilitate | P |
|----|--------------|---|
| H-TY | Tyre Hub core | P2 |
| H-IN | Insurance + FNOL | P2 |
| H-FU | Fuel card import | P2 |
| H-FI | Fines routing | P3 |
| H-TL | Toll/vignette | P2 (catalog existent) |

---

## L. Implicații pe financiar (rafinare față de arhitectura v1)

| Verticală | Obiecte financiare tipice | Risc dacă lipsește Finance Hub |
|-----------|---------------------------|--------------------------------|
| PARK | AP achiziție, cost recon, AR vânzare, floorplan interest | marjă falsă |
| LEASE | AR rate, AP service/tyre/insurance, accruals, EOC invoices | leakage pe excess/daune |
| RENT | deposits, AR rental, extras, damage, no-show | cash vs revenue confuz |
| FLEET | AR management fee / service pass-through | — |

**Propunere fermă rămâne A+C**, cu un **chart of operational accounts** minimal (nu CoA contabil full):

- Venituri: lease_rate, rent_hire, vehicle_sale, service_billable, excess_km, damage  
- Costuri: acquisition, recon, maintenance_in_contract, tyre, insurance_premium, loaner, fines_paid  
- Balans: deposits_held, claims_receivable  

Fiecare linie legată de `vehicleId` + `allocationId` + `contractId?` → TCO real.

---

## M. Experiență utilizator — „o zi din viață”

### M.1 Documentalist parc
Dimineața: coadă `DITL_PENDING` + `CIV_PENDING` → uploadează CIV → OCR completează profil → avansează la `REG_PENDING`.

### M.2 Fleet desk LO
Alertă: 3 mașini la 80% km · 1 daună FNOL · 2 revizii săptămâna viitoare → autorizează WO · alocă loaner · factură excess programată.

### M.3 Counter rent
Pickup: best-fit unitate · inspecție foto · contract semnat · depozit.  
Return: delta damage · turnaround job · unitate `Available` în 75 min.

### M.4 Contabil (extern)
Webhook `invoice.issued` → import în Oblio; la plată, inbound `payment.received` închide statusul în Finance Hub.

---

## N. Decizii de produs încă deschise (rafiniate)

1. **Ordine verticală post-CIV:** recomandare analitică = **PARK → RENT → LEASE** (PARK hrănește ambele; RENT e mai rapid de monetizat; LEASE e cel mai complex pe service matrix).  
2. **Loaner:** din ziua 1 RENT marchează `loaner_eligible`, chiar dacă LEASE vine în F4.  
3. **Finance A+C** confirmat ca default arhitectural.  
4. **Primul conector contabil:** de ales explicit (Oblio = cel mai ușor SMB RO).  
5. **Multi-țară:** schema multi-currency + tax profiles din F1, chiar dacă UI e RO-first.

---

## O. Surse de inspirație (extinse)

**LO / FML:** Ayvens, Alphabet 360, Sixt Leasing RO, Business Lease, Everest Fleet, Edocti Lease, Charisma Asset Finance, Asseco LEO, Moiboo, FleetFabric, Pargesoft, Wheels Operating Lease.  
**Rent:** Rental Car Manager, Wheels RMS, Europcar Opticar (yield), LendControl turnaround practices, AiRentoSoft (damage AI trend).  
**Dealer:** CDK Vehicle Inventory / Dealership Xperience, Reynolds, Dealertrack Open.  
**Tyre:** TyreOps, eFleetAdmin, FleetStack.  
**Intern:** `domain-model.md`, `service-catalog.md`, `integration-strategy.md`, `crm-service-flow-spec.md`, `identity-access-model.md`.

---

## P. Următorul pas

1. Validare direcție §N (în special ordine PARK→RENT→LEASE).  
2. **Revenire CIV 1993** (P0 / F-01) — fără identitate asset solidă, finețea de mai sus nu se sprijină.  
3. După CIV: epic **F-02 + F-03** (Allocation + Entitlements) ca premiză pentru orice verticală.

---

*Document de finețe operațională — v1.0. Se actualizează incremental; deciziile blocate se marchează explicit în changelog-ul de la începutul fișierului la v1.1+.*
