# Arhitectură multi-verticală: Fleet · Parc auto · Leasing operațional · Rent-a-Car

**Statut:** plan canonic de produs / arhitectură operațională (v1.1 — 2026-08-14)  
**Audiență:** product owner, arhitectură, comercial, dezvoltare  
**Prioritate:** completează (nu înlocuiește) `identity-access-model.md`, `domain-model.md`, `platform-foundation.md`, `integration-strategy.md`, `service-catalog.md`.  
**Context:** Fleet Enterprise este deja SaaS multi-tenant de **fleet management** (vehicule, CIV, documente, mentenanță, costuri, curse, CRM/service). Acest document adaugă verticalele **Parc auto (dealer)**, **Leasing operațional** și **Rent-a-Car**, cu interdependențe, financiar, entitlements și „robinete” de integrare.

**Deep-dive (finețe operațională, maturitate M1–M4, hubs, viitor, catalog P0–P3):**  
[`multi-vertical-operational-deep-dive.md`](multi-vertical-operational-deep-dive.md)

**Pauză tehnică explicită:** lucrul pe maparea **CIV 1993** rămâne deschis; se reia imediat după validarea acestui plan.

---

## 1. Viziune de produs (ambiție + dual-use)

### 1.1 Ce vindem

| Mod de folosire | Cine e tenant-ul | Ce face platforma |
|-----------------|------------------|-------------------|
| **A. Operator de servicii** | Compania voastră (sau un abonat tip FlotaX) | Administrează flote ale clienților contractuali + eventual parc / leasing / rent propriu |
| **B. Platformă white-label / SaaS** | Dealer, firmă de leasing, rent-a-car, flotă corporativă | Clientul plătește doar modulele activate; folosește platforma ca sistem de operare al business-ului |

Același **cod**, aceleași **entități de bază**, diferențiere prin:

1. **Entitlements** (module plătite / activate pe tenant)  
2. **Configurație de produs** (reguli leasing vs rent vs vânzare)  
3. **Roluri IAM** (deja pe 4 straturi: platformă → tenant → client → user)

### 1.2 Principiu arhitectural central — **Asset Pool unificat**

Toate verticalele operează pe **același stoc de active (vehicule)**, cu **stări și „ocupări”** diferite:

```
                    ┌─────────────────────────────┐
                    │     ASSET POOL (Vehicle)    │
                    │  VIN, CIV, docs, service…   │
                    └──────────────┬──────────────┘
           ┌───────────────┬───────┴───────┬───────────────┐
           ▼               ▼               ▼               ▼
     ┌──────────┐   ┌────────────┐  ┌────────────┐  ┌──────────────┐
     │  PARC    │   │  LEASING   │  │  RENT-A-   │  │ FLEET MGMT   │
     │  DEALER  │   │  OPERAȚ.   │  │  CAR       │  │ (clienți)    │
     │  (stock, │   │  (contract │  │  (rezerv., │  │  (asignare   │
     │  vânzare)│   │   long)    │  │   hire)    │  │   client)    │
     └──────────┘   └────────────┘  └────────────┘  └──────────────┘
           │               │               │               │
           └───────────────┴───────┬───────┴───────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  SERVICE / DOCS / COSTS     │
                    │  (deja în platformă)        │
                    └─────────────────────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  FINANCIAR + INTEGRĂRI      │
                    └─────────────────────────────┘
```

**Regulă de aur:** un vehicul are **o singură identitate** (`Vehicle` + CIV/docs). Modulele adaugă **ocupări** (`Allocation` / `Engagement`), nu copii de VIN.

---

## 2. Benchmark-uri din software de specialitate (ce am extras)

Sinteză din produse/platforme de referință — folosită ca checklist de excelență, nu ca copiere 1:1.

### 2.1 Leasing operațional / full-service fleet

| Referință | Ce fac bine (capabilități de luat) |
|-----------|-------------------------------------|
| **Alphabet 360 / Ayvens (ALD+LeasePlan)** | Portal unic; contract full-service (mentenanță, anvelope, asigurări, downtime); raportare costuri/ESG; booking scurt (Rent) pe același ecosistem |
| **Edocti Lease (RO/UE)** | Lead → ofertă → aprobare risc → contract → achiziție → livrare → flotă → remarketing; API către ERP/bănci/dealeri; pachete modulare Sales / Leasing / Fleet |
| **Charisma / TotalSoft Asset Finance** | Produs LF vs LO configurabil; evenimente pe contract (acte adiționale, reziliere, cesiune); collection; export contabil IFRS; portal dealer |

**Implicație pentru noi:** leasingul operațional = **contract + servicii incluse + asset lifecycle**, iar fleet management-ul pe care îl avem deja este **motorul post-livrare**.

### 2.2 Rent-a-Car

| Referință | Ce fac bine |
|-----------|-------------|
| **Rental Car Manager** | Availability engine pe reguli (turnaround, relocare); rezerve multi-canal + API agenți; alocare „best fit” la pickup; utilizare / revenue vs cost mentenanță; GPS opțional |
| **Fleetio Motor Pool** (aproape) | Pool intern de rezervări pe același fleet core |

**Implicație:** inima rent-a-car este **Availability + Contract scurt + Checkout/Return + Damage**; mentenanța și documentele sunt shared cu fleet.

### 2.3 Parc auto / Dealer (DMS)

| Referință | Ce fac bine |
|-----------|-------------|
| **CDK / Reynolds / Dealertrack** | Inventory end-to-end (achiziție → recondiționare → merchandising → deal → F&I); aging stock; service & parts; contabilitate dealership; Open API / ecosistem vendor |
| **Practică RO (DITL, RAR, DRPCIV)** | Fluxuri locale deja în catalogul nostru de servicii: RAR / DITL / DRPCIV / CIV — **avantaj competitiv** față de DMS US |

**Implicație:** parc = **pipeline de stoc** + **job-uri de pregătire** + **tranzacție de vânzare**; CIV/OCR pe care le construim acum sunt piese de aur pe acest flux (import → CIV → înmatriculare).

### 2.4 Financiar în platforme fleet/logistics

| Referință | Pattern |
|-----------|---------|
| **Fleetbase Ledger** | Sub-ledger operațional: CoA, double-entry, facturi, wallet; evenimente ops → jurnal automat; ERP rămâne GL de autoritate |
| **Charisma / Accflo-style** | Billing + revenue recognition separat de GL; export jurnal către ERP |

**Implicație (propunerea noastră §6):** **nu** înlocuim ERP-ul clientului în v1; construim **Operational Finance Hub** + exporturi, cu cale clară spre sub-ledger propriu.

---

## 3. Ce avem deja (ancoră) și ce lipsește

### 3.1 Deja în Fleet Enterprise (reutilizabil 1:1)

| Capacitate | Unde | Reutilizare |
|------------|------|-------------|
| Multi-tenant + IAM | `identity-access-model.md` | Entitlements pe module |
| Vehicle + CIV + documente + OCR | Fleet / Advanced CIV | Identitate asset pentru toate verticalele |
| Mentenanță, remindere, costuri | Domain model | Service pe leasing / rent / parc |
| CRM / service tickets | `crm-service-flow-spec.md` | Daune rent, recondiționare parc, downtime leasing |
| Integration Hub (schelet) | `integration-strategy.md` | Extins la ERP, DMS, booking engines |
| Catalog RAR/DITL/DRPCIV | `service-catalog.md` | Parc + leasing (înmatriculare, taxe) |

### 3.2 Lipsă structurală (de introdus)

1. **`VehicleAllocation` / `AssetEngagement`** — ocupare tip: `in_stock_park` | `for_sale` | `on_lease` | `on_rent` | `assigned_fleet_client` | `in_prep` | `decommissioned`  
2. **Contracte pe verticală** — `LeaseContract`, `RentalAgreement`, `SalesDeal`  
3. **Availability calendar** — pentru rent (+ eventual pool leasing temporary)  
4. **Stock pipeline parc** — etape achiziție → DITL → CIV → înmatriculare → prep → lot → vânzare  
5. **Entitlement / Catalog comercial de module**  
6. **Finance Hub** (facturare, rate, depozite, export GL)  
7. **Public API + Event Bus** („robinete”)

---

## 4. Module operaționale (detaliu)

### 4.0 Nucleu comun — `CORE_FLEET` (obligatoriu pentru orice pachet)

- Vehicle identity (VIN, CIV, talon, ITP, RCA…)  
- Documente + remindere expirări  
- Mentenanță / work orders / costuri  
- Clienți contractuali (organizații)  
- Audit, RBAC, multi-tenant  

**Fără CORE nu se activează niciun vertical.**

---

### 4.1 Modul `PARK_DEALER` — Administrare parc auto (noi + SH)

**Scop:** gestiunea stocului unui dealer / importator / remarketing, de la achiziție la livrare client.

#### Pipeline operațional (stări recomandate)

```
SOURCED → PURCHASED → IN_TRANSIT → CUSTOMS/IMPORT
  → DITL_PENDING → CIV_PENDING → REGISTRATION_PENDING
  → IN_YARD → RECON / PREP → ON_LOT (for_sale)
  → RESERVED → SOLD / DELIVERED
  → (opțional) AFTERSALES
```

| Etapă (cerința ta) | Capabilitate sistem | Entități / artefacte |
|--------------------|---------------------|----------------------|
| Achiziție | PO / factură furnizor, cost achiziție, sursă (licitație, import, trade-in) | `StockAcquisition`, `CostRecord` |
| Impunere DITL | Checklist + documente + status + deadline | Job tip `document_flow` / ticket CRM |
| Emitere CIV (import) | Upload scan + OCR CIV (2016/1993) → profil tehnic | `VehicleDocument`, CIV profile |
| Înmatriculare | Talon, nr. înmatriculare, SRPCIV | Documente + status |
| Reparație / recondiționare | Work orders, piese, costuri, SLA | Maintenance + CRM |
| Punere pe poziție în parc | Locație yard / slot, foto, chei | `YardLocation`, media |
| Întreținere pe staționare | Plan preventiv pe stoc (baterie, pornire, ITP) | MaintenancePlan pe status `in_stock` |
| Pregătire vânzare | Detail, foto merchandising, preț listă/target | `Listing`, pricing |
| Livrare | Checklist predare, contract vânzare, plată | `SalesDeal`, documents |

**KPI parc (profesionale):** days-in-inventory, aging buckets (0–30/31–60/61–90/90+), reconditioning cost vs margin, turn rate, % stock fără CIV/talon.

**Intersecții:** un stoc nevândut poate trece în **Rent** (demo/loaner) sau **Leasing** (asset pe contract); un retur leasing merge în **Parc** (remarketing).

---

### 4.2 Modul `LEASE_OPS` — Leasing operațional

**Scop:** full-service pe durata contractului: client plătește rată + servicii; operatorul deține/administrează asset-ul.

#### Flux comercial → operațional (din Edocti/Charisma/Alphabet)

```
Lead → Offer (produs LO + servicii) → Credit/Approval (opțional)
  → Contract → Vehicle sourcing (din Parc sau comandă nouă)
  → Delivery checklist → Active lease
  → Servicing / tires / insurance / fines / downtime
  → Amendments → End-of-term → Return inspection
  → Remarketing (Parc) | Extension | Buyout
```

| Bloc | Detaliu |
|------|---------|
| **Produs LO** | Durată, km inclus, rată, rezidual (informativ), pachet servicii (mentenanță, anvelope, replacement car…) |
| **Contract** | Acte, anexe, indexare, penalități excess km |
| **Asset binding** | `Vehicle` + `LeaseContract` (1:1 pe perioada activă) |
| **Operations** | Reutilizează mentenanță + CRM daune + documente (deja există) |
| **Downtime** | Ticket + vehicul înlocuitor din pool rent/parc (ca Alphabet downtime) |
| **Billing** | Rate lunare + extra (km, daune) → Finance Hub |
| **EOC** | Inspecție retur, wear & tear, facturare diferențe, eliberare asset |

**Diferență vs Fleet MGMT pur:** în fleet, clientul „deține” operațional mașina pe client contractual; în LO, **contractul de leasing** este sursa de adevăr pentru facturare și SLA, iar clientul final poate fi tot un `Client` din tenant.

---

### 4.3 Modul `RENT_CAR` — Rent-a-Car

**Scop:** închirieri pe termen scurt/mediu, disponibilitate, contracte, predare/retur.

#### Flux

```
Rate card / seasons → Quote → Reservation (hold)
  → Pickup (contract + deposit + checklist + odometer/fuel)
  → On-hire (optional telematics)
  → Return (checklist + damages + extras)
  → Invoice close → Vehicle turnaround → Available
```

| Bloc | Detaliu (din RCM) |
|------|-------------------|
| **Availability engine** | Reguli: turnaround hours, locații, clase (economy/SUV…), block-out mentenanță |
| **Reservation** | Canal: counter, web, API parteneri; overbooking policy |
| **Allocation** | La rezervare (soft) sau la pickup (best-fit) |
| **Agreement** | Șoferi, depunere, franchise daune, limită km |
| **Checkout/Return** | Media daune, semnătură, diferențe combustibil |
| **Utilisation** | % zile închiriate / venit pe unitate / revenue vs service cost |

**Pool partajat:** aceleași vehicule pot avea prioritate `RENT` sau pot fi „loaner” pentru leasing/service.

---

### 4.4 Modul `FLEET_MGMT` — Administrare flote clienți (existent, extins)

Rămâne verticala principală livrată azi:

- Client organizație → vehicule asignate  
- Conformitate documente, ITP, mentenanță, costuri, curse/FAZ  
- Poate rula **singur** (pachet SaaS flotă) sau ca **serviciu post-contract** pe LO  

---

## 5. Interdependențe operaționale (cum se leagă)

### 5.1 Matrice de dependențe

| Modul | Depinde de | Opțional consumă |
|-------|------------|------------------|
| CORE_FLEET | — | — |
| PARK_DEALER | CORE | FINANCE, RENT (loaner), LEASE (sourcing) |
| LEASE_OPS | CORE + Contract engine | PARK (sourcing/remarketing), RENT (replacement), FINANCE |
| RENT_CAR | CORE + Availability | PARK (overflow stock), FINANCE, telematics |
| FLEET_MGMT | CORE | LEASE (dacă clientul e pe LO), FINANCE |
| FINANCE_HUB | CORE | Toate verticalele (evenimente de facturat) |
| INTEGRATIONS | CORE | Toate |

### 5.2 Tranziții tipice între verticale (state machine asset)

Exemple de politici configurabile pe tenant:

1. **Parc → Leasing:** stoc `ON_LOT` selectat la livrare contract LO → status `ON_LEASE`  
2. **Leasing → Parc:** retur EOC → `RECON` → `ON_LOT` (remarketing)  
3. **Parc → Rent:** unități tinere pe lot → clasă rent → availability  
4. **Rent → Service → Rent:** block pe calendar pe durata WO  
5. **Fleet client → Service:** neschimbat față de azi  
6. **Orice → Decommission:** casare / export / vânzare externă

**Conflict rule:** un asset nu poate fi simultan `ON_LEASE` și `ON_RENT` (hard lock). Poate fi `IN_PREP` blocând availability.

---

## 6. Modulul Financiar — propuneri (decizie strategică)

Financiarul **nu** este un ecran izolat: este **proiecția monetară a evenimentelor operaționale**.

### 6.1 Propunere A — **Operational Finance Hub** (recomandat pentru 12–18 luni)

**Ce este:**

- Facturi emise (rate LO, chirii rent, vânzări parc, servicii fleet)  
- Facturi primite (legate de `CostRecord` existent)  
- Depozite / garanții rent  
- Journal **export** (nu GL complet) către Saga/WinMentor/OBLIO/QuickBooks/SAP  
- Centre de cost pe: vehicul, contract, client, locație  

**Ce nu este (încă):** contabilitate statutory completă, TVA complex multi-țară, salarii.

**De ce A:** potrivită cu realitatea RO (contabilul are deja ERP); reduce riscul; livrează valoare rapid; păstrează „robinetul” spre ERP.

### 6.2 Propunere B — **Sub-ledger double-entry** (medium term)

Ca Fleetbase Ledger: CoA intern, jurnal imutabil pe evenimente (`lease.invoice.posted`, `rent.closed`, `vehicle.sold`), reconciliere, apoi sync GL.

**Când:** după ce A rulează pe ≥2 verticale cu volum real.

### 6.3 Propunere C — **Finance + Billing SaaS** (comercial platformă)

Separat de ops finance:

- Stripe/Chargebee pentru **abonamente module** (entitlements)  
- Metering (nr. vehicule, nr. contracte active, OCR pages)  
- Invoice vendor → tenant  

**C** poate coexista cu **A** din ziua 1 (veniturile platformei ≠ veniturile business-ului tenant-ului).

### 6.4 Recomandare de produs

| Orizont | Livrabil |
|---------|----------|
| Acum → Q+2 | **A + C** (ops invoices/export + billing entitlements) |
| Q+3 → Q+5 | **B** pe evenimente critice (lease billing, rent close, vehicle sale) |
| Enterprise | Conectori ERP dedicați + IFRS notes doar dacă apare client LO mare |

### 6.5 Evenimente care trebuie să poată genera bani (minim)

| Eveniment | Verticală | Document financiar |
|-----------|-----------|--------------------|
| Rată lunară LO | LEASE | Invoice recurring |
| Excess km / daună | LEASE/RENT | Invoice ad-hoc |
| Închiriere închisă | RENT | Invoice + deposit release |
| Vânzare vehicul | PARK | Sales invoice / proformă |
| Work order facturat client | FLEET/LEASE | Invoice service |
| Cost furnizor | ALL | AP / CostRecord → export |

---

## 7. Entitlements & ambalare comercială (acces doar la module plătite)

### 7.1 Catalog module (SKU)

| Cod | Nume comercial | Dependențe |
|-----|----------------|------------|
| `CORE` | Fleet Core | — |
| `FLEET` | Fleet Management clienți | CORE |
| `PARK` | Parc auto / Dealer ops | CORE |
| `LEASE` | Leasing operațional | CORE (+ recomandat PARK) |
| `RENT` | Rent-a-Car | CORE |
| `FIN_OPS` | Finance Hub ops | CORE |
| `FIN_BILL` | Billing SaaS (plată platformă) | Platform |
| `API` | Public API & webhooks | CORE |
| `OCR_CIV` | CIV OCR avansat | CORE |
| `TELEMATICS` | Tracking connectors | CORE |

### 7.2 Enforcement tehnic

- `TenantEntitlement(moduleCode, status, seats?, vehicleQuota?, validUntil?)`  
- Guard API: `@RequiresModule('LEASE')`  
- UI: nav items ascunse dacă modulul lipsește (nu doar disabled)  
- Feature flags pe tenant pentru beta  

Aliniere IAM: entitlements = **ce module există**; RBAC = **cine ce face în modul**.

### 7.3 Pachete exemplu (comercial)

1. **Fleet SaaS** — CORE+FLEET (+OCR)  
2. **Dealer** — CORE+PARK+FIN_OPS+OCR  
3. **Mobility operator** — CORE+PARK+LEASE+RENT+FIN_OPS+API  
4. **Rent only** — CORE+RENT+FIN_OPS  

---

## 8. Integrări & „robinete” (aplicația ca sursă de date)

### 8.1 Principiu: **API-first + Event-first**

Orice entitate canonică trebuie să poată fi:

1. **Citită** prin REST/GraphQL (read models)  
2. **Subscrisă** prin webhooks / Pub/Sub  
3. **Exportată** batch (CSV/JSON) pentru contabilitate  

### 8.2 Robinete (Outbound — noi → sisteme client)

| Robinet | Payload tipic | Consumatori |
|---------|---------------|-------------|
| `vehicle.upserted` | VIN, status, odometer, docs expiry | ERP asset register, BI |
| `contract.lease.activated` | contractId, client, vehicle, rate | ERP revenue, CRM |
| `rent.agreement.closed` | charges, deposit, damages | Accounting, CRM |
| `vehicle.sold` | deal value, buyer, margin | ERP, ANAF e-Factura (viitor) |
| `cost.posted` | CostRecord lines | Contabilitate |
| `invoice.issued` | PDF + lines + VAT | WinMentor/OBLIO/Saga |
| `maintenance.completed` | WO + parts | DMS / warranty systems |
| `document.expiring` | type, date | Notificări, HR flotă |

### 8.3 Robinete (Inbound — sisteme → noi)

| Sursă | Utilitate |
|-------|-----------|
| Telematics | odometer, GPS (deja în strategie) |
| Contabilitate | status plată factură |
| Website booking / OTAs | rezervări RENT |
| Bănci / scoring | aprobare LEASE (opțional) |
| Licitații / feed stoc | achiziții PARK |
| e-Factura / SPV | conformare RO (fază ulterioară) |

### 8.4 Standard tehnic (extinde `integration-strategy.md`)

- **OpenAPI 3** public per modul  
- **Idempotency-Key** pe POST  
- **Webhook signatures** (HMAC)  
- **Partner apps** cu OAuth2 client credentials pe tenant  
- **Sandbox tenant** obligatoriu pentru integratori  
- Versionare `/v1` — breaking changes doar cu deprecation ≥ 90 zile  

### 8.5 Premize comerciale pe integrări

- SKU `API` plătit (rate limit generos pe Enterprise)  
- Marketplace ulterior: conectori certificați (ca Dealertrack OpenTrack)  

---

## 9. Model de date — extensii minime pe `domain-model.md`

### 9.1 Entități noi (schemă țintă)

```
Vehicle (existent)
  + operationalStatus   // fine-grained
  + ownershipType       // owned | leased_in | consignment | customer_owned
  + primaryModuleHint   // park|lease|rent|fleet (nu exclusiv)

VehicleAllocation
  id, tenantId, vehicleId
  kind: park_stock | lease | rent | fleet_assignment | service_block | transport
  refType, refId        // LeaseContract | RentalAgreement | SalesDeal | Client
  startsAt, endsAt?
  status: planned|active|closed

LeaseContract / LeaseOffer / LeaseProduct
RentalAgreement / Reservation / RatePlan / Location
StockAcquisition / YardLocation / SalesDeal / Listing
Entitlement
Invoice / InvoiceLine / Payment / Deposit  (Finance Hub)
IntegrationEndpoint / WebhookDelivery
```

### 9.2 Status vehicul — unificare

Statusul grosier existent (`active|inactive|in_maintenance|decommissioned`) rămâne;  
**operationalStatus** + **allocations** oferă adevărul fin pentru parc/lease/rent.

---

## 10. UX / navigare (schemă)

Grupuri sidebar (extindere pe Variant C):

1. **Panou**  
2. **Flotă** (vehicule, documente, CIV) — CORE  
3. **Service** (mentenanță, daune, furnizori) — CORE  
4. **Parc** — PARK  
5. **Leasing** — LEASE  
6. **Rent** — RENT  
7. **Clienți & CRM**  
8. **Financiar** — FIN_OPS  
9. **Integrări & API** — API  
10. **Administrare** (IAM, entitlements)  

Modulele inactive **nu apar**.

---

## 11. Roadmap de livrare (operațional, nu doar IT)

| Fază | Focus | Outcome |
|------|-------|---------|
| **F0** (acum) | Finalizare CIV OCR (2016 + 1993) pe CORE | Identitate asset de încredere |
| **F1** | `VehicleAllocation` + Entitlements + Finance Hub A (facturi + export) | Baza multi-verticală |
| **F2** | PARK pipeline (achiziție→lot→vânzare) folosind CIV/DITL | Dealer ops MVP |
| **F3** | RENT availability + agreement + return | Rent MVP |
| **F4** | LEASE offer→contract→billing→EOC; legătură PARK remarketing | LO MVP |
| **F5** | Public API v1 + webhooks + 1 conector contabil RO | Robinete live |
| **F6** | Sub-ledger B + portal client self-service | Enterprise |

Fiecare fază trebuie să aibă **pilot pe un tenant real** (ca FlotaX), nu doar demo.

---

## 12. Riscuri & principii de design (ca să rămână „well designed”)

1. **Un VIN = un Vehicle** — interzic duplicate pe verticale.  
2. **Contractul nu înlocuiește asset-ul** — contractul referă asset-ul.  
3. **Service este transversal** — nu clona mentenanța per modul.  
4. **Financiarul consumă evenimente**, nu UI-ul ops nu „tastează” în contabilitate.  
5. **Entitlements înainte de features** — altfel nu poți vinde modular.  
6. **Integrările sunt produs**, nu afterthought — OpenAPI din F1.  
7. **RO-first compliance** (DITL, RAR, CIV, e-Factura later) = diferențiator vs DMS globale.  
8. **Nu bloca CIV** — calitatea datelor tehnice alimentează parc + leasing + rent.

---

## 13. Decizii pe care le așteptăm de la product owner

1. **Ordinea verticalelor după CIV:** recomandare din deep-dive = **PARK → RENT → LEASE** (PARK hrănește stocul; RENT monetizează rapid; LEASE e cel mai complex pe service matrix). Alternativă: PARK → LEASE → RENT.  
2. **Finance:** confirmi Propunerea **A+C** ca start?  
3. **Ownership asset pe LO:** mașinile sunt mereu în tenant-ul operatorului (da/nu)?  
4. **Rent pe același stoc cu Parc** din MVP sau pool separat? (recomandare: același pool + flag `loaner_eligible`)  
5. **Primul conector ERP** țintă (Oblio / Saga / WinMentor / altul)? (recomandare SMB: Oblio)

Detalii și catalog capabilități P0–P3: deep-dive §K–N.

---

## 14. Referințe externe (surse de inspirație)

- Alphabet 360 / Ayvens / Sixt Leasing RO / Business Lease / Everest Fleet — full-service LO  
- Edocti Lease, Charisma Asset Finance, Asseco LEO, Moiboo, FleetFabric — contract & FML software  
- Rental Car Manager, Wheels RMS, Europcar Opticar — availability / yield  
- CDK / Reynolds / Dealertrack — DMS inventory & open integrations  
- TyreOps / eFleetAdmin — tyre lifecycle  
- Fleetbase Ledger — ops → journal pattern  
- Documente interne: `identity-access-model.md`, `domain-model.md`, `integration-strategy.md`, `service-catalog.md`, **`multi-vertical-operational-deep-dive.md`**

---

## 15. Următorul pas imediat

1. Validare decizii §13 (scurt workshop) — sau acceptarea recomandărilor din deep-dive.  
2. **Revenire la CIV 1993** (mapare încă incompletă pe staging) — prioritate tehnică pe asset identity (F-01 / P0).  
3. După CIV stabil: epic F1 (`Allocation` + Entitlements) ca fundație pentru PARK/RENT/LEASE.

---

*Document salvat ca sursă de adevăr pentru extinderea multi-verticală. Finețea operațională trăiește în deep-dive. Actualizările se fac prin versiuni fără a șterge deciziile blocate.*
