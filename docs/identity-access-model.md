# Identity & Access Model (IAM) — document fundațional

**Statut:** canonic — baza întregii aplicații pentru identitate, izolare date și drepturi.  
**Audiență:** product owner, arhitectură, dezvoltare, handoff pilot, suport.  
**Prioritate:** la conflict cu alte documente sau implementări ad-hoc, **acest document are prioritate** pentru subiectele IAM.

**Referințe înrudite:** `platform-foundation.md` (infrastructură), `domain-model.md` (entități business), `roadmap-2026-q3-q4.md` (calendar livrabile).

---

## 1. Viziune de produs

Fleet Enterprise este o **platformă SaaS de fleet management**: operatorul platformei (vendor) vinde dreptul de utilizare către **abonați** — firme care își gestionează flotele (proprii sau ale altora).

Fiecare **abonat** operează într-un **tenant** izolat. În interiorul tenant-ului, abonatul:

- înregistrează **clienți contractuali** (organizații) și vehiculele aferente;
- rulează operațiuni (documente, mentenanță, costuri, curse, FAZ);
- (țintă) invită **useri** cu roluri diferite — la nivel tenant, per client contractual, sau ca parteneri.

**Decizie strategică (fixată):** model **SaaS multi-tenant (varianta B)**.  
Un abonat = un **tenant**. Nu amestecăm tenant-ul unui abonat cu modulul **Clienți** al altui tenant.

---

## 2. Ierarhia canonică (patru straturi)

```
┌──────────────────────────────────────────────────────────────────┐
│ STRAT 0 — PLATFORMĂ (vendor)                                      │
│ Rol țintă: platform_admin / superadmin                          │
│ Gestionează: tenant-i (abonați), suport, configurare globală     │
│ Acces date: cross-tenant doar pentru operațiuni platformă         │
│ Stare: NU în aplicație — manual (GCP, Neon, seed, SQL)          │
└──────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ STRAT 1       │     │ STRAT 1       │     │ STRAT 1       │
│ Tenant demo   │     │ Tenant flotax │     │ Tenant …      │
│ (intern/test) │     │ (abonat pilot)│     │ (viitor)      │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│ STRAT 2       │     │ STRAT 2       │
│ Client A, B…  │     │ Client A, B…  │
│ (organizații  │     │ (organizații  │
│  contractuale)│     │  contractuale)│
└───────────────┘     └───────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│ STRAT 3       │     │ STRAT 3       │
│ Vehicule, ops │     │ Vehicule, ops │
│ remindere…    │     │ remindere…    │
└───────────────┘     └───────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│ STRAT 4       │     │ STRAT 4       │
│ Useri scoped  │     │ Useri partener│
│ (țintă)       │     │ (țintă)       │
└───────────────┘     └───────────────┘
```

| Strat | Entitate | Exemplu | Login în app |
|-------|----------|---------|--------------|
| **0** | Platformă | Echipa vendor | Nu (încă) |
| **1** | **Tenant** | `demo`, `flotax` | Da — `TenantMembership` |
| **2** | **Client** | „Alpha SRL” în tenant-ul FlotaX | Nu — entitate business, nu cont |
| **3** | Date operaționale | Vehicul, cursă, cost | — |
| **4** | Useri sub-abonat | Dispecer client A, șofer, furnizor | Da — de construit |

---

## 3. Terminologie obligatorie

| Termen | Înseamnă | Nu înseamnă |
|--------|----------|-------------|
| **Tenant** | Abonat SaaS; graniță de izolare date | Client contractual |
| **Client** (`/fleet/clients`) | Organizație contractuală **în** tenant | Abonatul FlotaX; user de login |
| **User** | Persoană cu email + parolă | Șofer ca text liber pe cursă |
| **tenant_admin** | Administrator al **întregului** tenant abonat | Superadmin platformă |
| **tenant_viewer** | Citire **întreg** tenant | Viewer doar pe un Client |
| **Pilot FlotaX** | Tenant `flotax` — abonat real | Client în tenant-ul `demo` |

**Regulă:** `admin@demo.local` **nu** vede datele tenant-ului `flotax` — izolare intenționată, nu bug.

---

## 3.5 Niveluri L, profile F/T/G și axa R (canonic — 2026-07)

**UI:** hartă vizuală editabilă în **Administrare → Strategie useri** (`/fleet/user-strategy`, `UserStrategyEditor`); persistată în `Tenant.iamStrategyMap`.

### 3.5.1 Ierarhia L (linie de comandă)

| Nivel | Cine | Scope | Rol DB azi | Stare |
|-------|------|-------|------------|-------|
| **L\*\*** | Owner platformă / vendor (business + app) | Cross-tenant; corecții tot (parole, km, useri) | `platform_admin` — **în afara app** | Planificat |
| **L\*** | Admin abonat (FlotaX) — administrare clienți Alpha, Beta, Client_1… | Tot tenant-ul | `tenant_admin` / `tenant_viewer` | Live |
| **L1** | Manager / angajat al **clientului contractual** | Unul sau mai mulți `Client` | `client_user` + `client_admin` / `client_dispatcher` / `client_viewer` | Live |
| **L0** | Utilizator mașină / șofer (angajat client) | Vehicule asignate + tichete scoped | `client_user` + `driver` | Live |

**Notă CRM:** în cod, nivelul L* apare ca `L_STAR` / „L★” pe evenimente tichet — **același lucru** cu **L\*** din documentație.

**L1+N** = etichetă de **rutare tichet** (escaladare la FlotaX), **nu** tip de user.

### 3.5.2 Profile funcționale F · T · G (pe L* și L1)

Financiar (**F**), Tehnic (**T**), Logistică (**G**) **nu** sunt trepte ierarhice noi — sunt **job-uri** pe aceeași treaptă L:

| Profil | Misiune | Exemple acțiuni |
|--------|---------|-----------------|
| **F** | Bani, buget, conformitate | Aprobă deviz, post-cost, factură, rapoarte cost |
| **T** | Mașini, service, conformitate tehnică | Tichete, dosar, deviz edit (fără aprobare), ITP |
| **G** | Mișcare, timp, coordonare | Programator, curse, șoferi, disponibilitate vehicule |
| **full** | Toate capabilitățile nivelului | `tenant_admin`, `manager.alpha` (pilot F5) |

**Separare deviz (separation of duties):** T editează → F aprobă → F (sau L* full) înregistrează cost/factură.

**Implementare:** profile F/T/G = epic IAM post-pilot; **F5** livrează L* full + L1 full + L0.

### 3.5.3 Axa R — parteneri furnizori (separat de L)

Furnizorii **nu** sunt sub L0/L1 — sunt **parteneri externi** pe modul Devize & comenzi:

| Nivel R | Cine | Scope |
|---------|------|-------|
| **R\*** | Admin organizație furnizor | Service auto, distribuitor piese, depozit anvelope… |
| **R1** | Operator furnizor | Deviz, programare WO, status reparație, factură |
| **R0** | Utilizator limitat furnizor | Vizualizare comenzi alocate |

Tipuri partener: `R-service`, `R-parts`, `R-tires`, `R-fuel`, `R-insurer` (mapate pe `Supplier.category`).

### 3.5.4 Useri de referință (demo vs pilot)

| Nivel | Tenant `demo` | Tenant `flotax` |
|-------|---------------|-----------------|
| L\*\* | — (manual) | — (manual) |
| L\* | `admin@demo.local` | `flotax_admin@flotax.local` |
| L1·full | `manager.alpha@demo.local` | `client1flotax@flotax.local` * |
| L0 | `sofer.alpha@demo.local` | `client1flotaxsofer@flotax.local` * |

\* Useri client FlotaX: creați manual via `/tenant/client-memberships` (seed FlotaX = doar admin).

### 3.5.5 Diagramă compactă

```
L**  owner platformă (vendor)
  │
L*   admin tenant ──┬── F financiar
  │                 ├── T tehnic
  │                 ├── G logistică
  │                 └── full
  │
L1   angajat client ─┬── F · T · G · full  (scope: un Client)
  │
L0   șofer / user mașină
  │
R*   partener furnizor (axă separată, viitor)
```

**Referință flux service:** `docs/crm-service-flow-spec.md` (F5 — tichete, programator, devize & comenzi).

---

## 4. Roluri — țintă vs. implementat

### 4.1 Strat platformă (țintă — neimplementat)

| Rol țintă | Responsabilități |
|-----------|------------------|
| `platform_admin` | CRUD tenant-i, suspendare abonat, suport read-only cross-tenant, metrici globale |
| `platform_support` (opțional) | Read-only cross-tenant, fără modificare date abonat |

**Azi:** rolul este exercitat **în afara aplicației** (GCP Console, Neon, `npm run db:seed:flotax`, SQL).

### 4.2 Strat tenant (implementat — MVP pilot)

| Rol | Scope | Drepturi |
|-----|-------|----------|
| `tenant_admin` | Tot tenant-ul din JWT | CRUD flotă, ops, membri tenant, FAZ; schimbă rol admin↔viewer; L* CRM |
| `tenant_viewer` | Tot tenant-ul din JWT (dacă **fără** ClientMembership) | Doar GET; UI ascunde acțiuni de scriere |
| `client_user` | Restricționat de `ClientMembership` | Portal client — CRM L0/L1, clienți/vehicule scoped |

Implementare: `TenantMembership.role`, JWT `role`, `@Roles()` pe API, `canManageFleet()` / `canWriteTickets()` în web.

### 4.3 Strat client contractual (implementat parțial — Post-pilot 2)

| Rol țintă | Scope | Exemplu | Nivel CRM |
|-----------|-------|---------|-----------|
| `client_admin` | Unul sau mai mulți `Client` | Managerul flotei Alpha SRL | L1 |
| `client_dispatcher` | Client alocat | Dispecer | L1 |
| `client_viewer` | Client alocat | Contabil client | L1 (doar citire) |
| `driver` (user) | Subset vehicule / client | Șofer cu login | L0 |

**Model de date:** `ClientMembership` (`userId`, `tenantId`, `clientId`, `role`, `driverId?`) + `TenantMembership.role = client_user`.

**API:** `GET/POST/DELETE /tenant/client-memberships` (doar `tenant_admin`). Filtrare automată pe `clientId` în CRM, clienți, vehicule.

**Decizii produs (2026-05):**
- L1 (client) și L* (FlotaX) pot amândoi rezolva tichete; fiecare acțiune în timeline cu actor + nivel (L0/L1/L*).
- Rezolvare tichet: comentariu obligatoriu („cum s-a rezolvat”).
- Parteneri/furnizori: scope separat în modul Devize & Comenzi (R1), nu în CRM general.
- `flotax_sofer` (tenant_viewer pe tot tenant-ul) — **depreciat**; șoferii reali sunt useri `client_user` + `ClientMembership.driver`.

### 4.4 Parteneri / terți (țintă — planificat Phase 1)

| Rol țintă | Scope | Calendar documentat |
|-----------|-------|---------------------|
| `supplier` / portal furnizor | Work orders, devize | `phase1-mvp-scope.md` §8; **out of scope Q3–Q4** |

Integrare telemetrie partener: `roadmap-2026-q3-q4.md` §10 Faza C — adapter tehnic, nu neapărat user app.

---

## 5. Stare curentă (baseline — iunie 2026)

### Schema DB (relevant IAM)

```
User (email global unic)
  └── TenantMembership (userId + tenantId + role)
        role ∈ { tenant_admin, tenant_viewer }

Tenant
  └── Client (organizație contractuală)
        └── Vehicle (clientId FK)
```

**Lipsește:** `Permission` matrix configurabilă din Setări, `platform_admin`, invite UI, notificări email/push la comentarii CRM.

**Adăugat (Post-pilot 2 parțial):** `ClientMembership`, `client_user`, scope API CRM + clienți + vehicule, audit actor L0/L1/L★ pe evenimente tichet.

### Autentificare

1. `POST /auth/login` — email, parolă, `tenantSlug` (obligatoriu dacă userul e în >1 tenant).
2. JWT: `sub`, `tenantSlug`, `email`, `role`.
3. Fiecare request: `tenantId` derivat din JWT — **fără** `clientIds` în token.

### Autorizare API

- Guard: `JwtAuthGuard` + `RolesGuard` cu enum `MembershipRole`.
- Pattern binar: scriere (`tenant_admin`) vs citire (+ viewer).
- **Niciun** endpoint nu filtrează după „clienții permisi userului” — nu există conceptul încă.

### UI

- `canManageFleet()` ≡ `role === "tenant_admin"`.
- `/fleet/members` — listă membri, PATCH rol (doar admin); **fără** creare user din UI.
- `/fleet/user-strategy` — hartă IAM editabilă (drag, add/delete noduri), salvată per tenant.
- Useri noi: seed / SQL / Prisma Studio (`go-live-pilot-checklist.md` §2).

### Tenanți de referință (staging)

| Tenant | Scop | Admin exemplu |
|--------|------|---------------|
| `demo` | Sandbox intern echipă | `admin@demo.local` |
| `flotax` | Abonat pilot (client real) | `flotax_admin@flotax.local` |

Acești admini sunt **pe același nivel tehnic** (`tenant_admin`), în tenant-i **diferiți**.

---

## 6. Cine gestionează pe cine (azi vs. țintă)

| Acțiune | Azi | Țintă |
|---------|-----|-------|
| Creare tenant (abonat nou) | Manual — seed / SQL | `platform_admin` UI |
| Creare user în tenant | Manual — seed / SQL | `tenant_admin` invite + `platform_admin` suport |
| Schimbare rol tenant | `tenant_admin` în `/fleet/members` | + roluri client / partener |
| Creare Client contractual | `tenant_admin` | `tenant_admin` (neschimbat) |
| Useri per Client | — | `tenant_admin` sau `client_admin` |
| Acces la toate tenant-urile | Echipa vendor (infra) | `platform_admin` în app |
| Acces la tot tenant-ul FlotaX | `flotax_admin` | `flotax_admin` (+ roluri subordinate) |
| Acces demo la date FlotaX | **Interzis** (izolare) | **Interzis** (corect SaaS) |

---

## 7. Principii de design (obligatorii pentru cod nou)

1. **Tenant-first:** orice entitate operațională are `tenantId`; niciun query fără filtru tenant din JWT (sau context platformă explicit).
2. **Fără superadmin implicit:** `tenant_admin` pe `demo` **nu** primește acces cross-tenant — nu „fallback” la alt tenant.
3. **Client ≠ Tenant:** nu denumi abonați SaaS în modulul Clienți; nu căuta tenant-ul `flotax` în lista Clienți din `demo`.
4. **Pregătire scope client:** filtrele `clientId` din API sunt pentru **date**, nu pentru **autorizare** — până la `ClientMembership`, presupunem că admin tenant vede tot.
5. **Evită rol binar în profunzime:** noi module să nu hardcodeze doar `canManageFleet`; preferă verificări care pot evolua spre permisiuni (comentariu / abstraction layer).
6. **Re-login la schimbare rol:** JWT conține rolul la emitere; schimbarea rolului necesită token nou.
7. **Zero tenant leak:** incidente cross-tenant = severitate maximă; teste e2e obligatorii la orice schimbare IAM.

---

## 8. Evoluție planificată (ordine recomandată)

| Fază | Epic | Livrabil | Notă calendar |
|------|------|----------|---------------|
| **Pilot (acum)** | Tenant RBAC MVP | `tenant_admin` / `tenant_viewer` | ✅ livrat |
| **Post-pilot 1** | Platform admin | UI + API creare/gestionare tenant | Înainte de al 2-lea abonat plătitor |
| **Post-pilot 2** | Client scope IAM | `ClientMembership`, roluri client, filtrare API | ✅ parțial livrat (CRM + core) |
| **Post-pilot 3** | Invite & self-service | Creare user de `tenant_admin` | Înlocuiește seed manual |
| **Phase 1 (R1)** | Portal furnizori | Autentificare partener, scope work orders | `phase1-mvp-scope.md` §8 |
| **Maturitate** | Permission matrix | `Permission` + `@RequirePermission` | `platform-foundation.md` §2 |

**Explicit out of scope pilot Q3–Q4:** portal client final, useri per client, `platform_admin` în app (`go-live-pilot-checklist.md`, `pilot-handoff-flotax.md`).

---

## 9. Implicații pilot FlotaX

- FlotaX = **abonat SaaS** (tenant `flotax`), **nu** client în `demo`.
- `flotax_admin` = echivalentul lui `admin@demo` **în propriul workspace** — gestionează clienții **săi** (organizații), vehicule, ops, coadă L★.
- Useri ai clienților FlotaX (șofer, manager Alpha): `client_user` + `ClientMembership` — creați de `flotax_admin` via API `/tenant/client-memberships`.
- ~~`flotax_sofer` = `tenant_viewer`~~ — **eliminat** (model invalid: FlotaX administrează, nu conduce vehicule).

---

## 10. Anti-pattern-uri (de evitat)

| Greșeală | De ce e problematic |
|----------|---------------------|
| Tratarea lui FlotaX ca `Client` în demo | Încalcă modelul SaaS și confundă straturile |
| Presupunerea că demo = superadmin | Creează așteptări false; nu există rolul |
| Useri „client final” fără `ClientMembership` | Văd tot tenant-ul — risc confidențialitate |
| Adăugare roluri doar în UI fără API guards | Securitate iluzorie |
| Un singur user în mai mulți tenant-i fără UX clar | Login necesită `tenantSlug` explicit |

---

## 11. Checklist review (IAM) — pentru PR-uri

- [ ] Query-uri noi filtrează `tenantId` din context JWT?
- [ ] Endpoint-urile de scriere au `@Roles(tenant_admin)` sau echivalent viitor?
- [ ] UI ascunde acțiuni pentru viewer unde e cazul?
- [ ] Nu se expun date din alt tenant în teste/fixtures?
- [ ] Documentația user-facing folosește terminologia §3?
- [ ] Dacă atinge `clientId`: e filtru de date sau (viitor) autorizare — e documentat?

---

## 12. Istoric decizii

| Data | Decizie |
|------|---------|
| 2026-07 | Pagină **Strategie useri** (`/fleet/user-strategy`) — hartă IAM editabilă, `Tenant.iamStrategyMap` |
| 2026-07 | Ierarhie L**, L*, L1, L0, profile F/T/G, axa R — §3.5; hartă UI `/fleet/members` |
| 2026-06 | Model producție: **SaaS multi-tenant**; abonat = tenant; FlotaX = tenant pilot |
| 2026-06 | Superadmin platformă: **în afara app** până la epic `platform_admin` |
| 2026-06 | Useri per client contractual: **țintă**, epic dedicat post-pilot |
| 2026-05 | Post-pilot 2 parțial: `ClientMembership`, CRM scoped L0/L1/L★, deprecare `flotax_sofer` |
| 2026-06 | Acest document devine **sursă canonică IAM** |

---

## 13. Documente de aliniat la acest model

| Document | Acțiune |
|----------|---------|
| `README.md` | Link către acest doc la secțiunea autentificare |
| `platform-foundation.md` | RBAC detaliat → defer la acest doc |
| `pilot-handoff-flotax.md` | FlotaX = abonat tenant |
| `roadmap-2026-q3-q4.md` | Epic-uri IAM referă §8 din acest doc |
| `go-live-pilot-checklist.md` | Limitări pilot IAM |
| `domain-model.md` | Entitățile respectă `tenantId`; user scope = strat 4 |

**Revizuire:** la fiecare epic IAM sau la onboard abonat nou; owner: Product + Tech Lead.
