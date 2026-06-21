# Predare pilot FlotaX — staging

**Scop:** materiale pentru handoff către clientul pilot și checklist intern înainte/după predare.  
**Mediu:** **staging** (nu producție dedicată) — date partajate infrastructură cu testele interne; tenant izolat `flotax`.

**Referințe:** [`identity-access-model.md`](identity-access-model.md) (model SaaS — FlotaX = abonat tenant), `docs/go-live-pilot-checklist.md` (§7 semnare), `docs/roadmap-2026-q3-q4.md` (§10 consum).

---

## 0. Model conturi (pentru echipă — nu trimite clientului)

FlotaX este **abonat SaaS** (tenant `flotax`), **nu** un „client” în tenant-ul `demo`. `flotax_admin` are aceleași tipuri de drepturi ca `admin@demo.local`, dar **doar în tenant-ul FlotaX**. Echipa vendor nu vede datele FlotaX din contul demo — by design.

Detaliu complet: [`identity-access-model.md`](identity-access-model.md).

---

## 1. Checklist intern (înainte de predare)

| # | Task | OK |
|---|------|-----|
| 1 | Conturi FlotaX verificate: `npm run db:verify:flotax` pe Neon staging | ☐ |
| 2 | Login admin + șofer pe URL staging (browser separat pentru șofer) | ☐ |
| 3 | Parolă transmisă **o singură dată** pe canal securizat (nu email clar, nu chat public) | ☐ |
| 4 | **2.4** — rotire parolă Neon dacă `DATABASE_URL` a fost expusă; update Secret Manager | ☐ |
| 5 | Client are ≥ 1 client organizație + vehicule de test (sau știe că le introduce el) | ☐ |
| 6 | Contact suport definit (email / telefon / SLA răspuns) — completat în §3 | ☐ |
| 7 | §7 `go-live-pilot-checklist.md` semnat / datat (intern + client) | ☐ |
| 8 | (Opțional) Cloud Run min instances = 1 pe `fleet-api` + `fleet-web-stg` | ☐ |

**După predare (săptămâna 1–4):**

| # | Task | OK |
|---|------|-----|
| 9 | Client a reușit login fără asistență | ☐ |
| 10 | ≥ 1 FAZ sau foaie parcurs generată pe perioadă reală | ☐ |
| 11 | Feedback centralizat (notițe / call 30 min la 2 săptămâni) | ☑ feedback scurt §5.1 (2026-06) |

---

## 2. Fișă tehnică (de atașat la handoff)

| Element | Valoare |
|---------|---------|
| **URL aplicație** | https://fleet-web-stg-1096713529891.europe-west1.run.app/login |
| **Tenant (slug)** | `flotax` |
| **Administrator** | Email: `flotax_admin@flotax.local` — rol: gestiune completă |
| **Șofer (citire)** | Email: `flotax_sofer@flotax.local` — rol: vizualizare, fără creare vehicul / FAZ |
| **Parolă** | *[comunicată separat — aceeași pentru ambele conturi la pilot]* |
| **Mediu** | Staging — posibile reporniri după deploy; prima accesare poate dura câteva secunde |
| **Browser** | Chrome / Edge recent; mobil = funcțional, liste tip tabel |

**Logout:** meniu flotă → Deconectare (sau ștergere cookie dacă testați mai multe conturi — folosiți **2 browsere** pentru admin + șofer simultan).

---

## 3. Suport pilot (completează înainte de trimitere)

| | |
|---|---|
| **Contact tehnic** | *[Nume, email, telefon]* |
| **Program răspuns** | ex. L–V 9–18, răspuns în 24h lucrătoare |
| **Raportare problemă** | Descriere + captură ecran + ora + cont folosit (admin/șofer) |
| **Urgențe** | *[telefon]* |

---

## 4. Text pentru client (copy-paste)

> Înlocuiește `[PAROLA]` și `[CONTACT]` înainte de trimitere. Nu trimite parola în același mesaj cu URL-ul, dacă poți evita — sau folosește SMS / apel pentru parolă.

---

**Subiect:** Acces pilot Fleet Enterprise — FlotaX (staging)

Bună ziua,

Aplicația de gestiune flotă este pregătită pentru **pilotul FlotaX** pe mediul de staging.

### Acces

- **Link:** https://fleet-web-stg-1096713529891.europe-west1.run.app/login  
- **Organizație (tenant):** `flotax`  
- **Administrator flotă:** `flotax_admin@flotax.local`  
- **Cont șofer (doar vizualizare):** `flotax_sofer@flotax.local`  
- **Parolă:** *[transmisă separat]*

La primul login veți ajunge la **Panou general (Acasă)** — indicatori flotă și linkuri către listele detaliate.

### Ce puteți face acum (administrator)

- **Clienți** — organizații contractuale  
- **Vehicule** — legate de client, ITP, documente  
- **Documente & remindere** — expirări, acțiuni  
- **Mentenanță & costuri** — reparații, combustibil, alte cheltuieli  
- **Curse** — trasee; generare **foaie de parcurs** și **FAZ lunar** (PDF descărcabil)  
- **Export** CSV unde este disponibil în listă  

Contul **șofer** vede datele, dar **nu** poate adăuga vehicule sau genera documente FAZ.

### Recomandări la început

1. Completați restul vehiculelor și clienților din flotă.  
2. Introduceți ITP și documentele principale (RCA, etc.).  
3. În prima lună: generați **cel puțin un FAZ** sau foaie de parcurs pentru perioada reală.  
4. Folosiți aplicația de **cel puțin 3 ori pe săptămână** în primele săptămâni — ne ajută să validăm pilotul.

### Limitări (pilot curent)

- **Fără** hartă / tracking GPS live.  
- **Fără** portal separat pentru clienții dumneavoastră finali.  
- **Consum combustibil** — calcule de bază; **îmbunătățiri planificate** (consum pe distanță, viitor integrare nivel rezervor).  
- **Staging** — după actualizări rare, prima încărcare poate dura câteva secunde.  
- Utilizatori noi: doar prin echipa noastră (nu self-service încă).

### Suport

Pentru întrebări sau probleme: **[CONTACT — email/telefon]**.

Vă rugăm la raportare să includeți: ce făceați, mesajul de eroare (dacă apare) și captură de ecran.

Cu stimă,  
*[Semnătură]*

---

## 5. Ghid rapid prima săptămână (pentru client — opțional PDF/email 2)

| Zi | Activitate |
|----|------------|
| 1 | Login admin → verificare dashboard → 1 client + toate vehiculele |
| 2 | Documente + ITP pe vehicule reprezentative |
| 3 | Remindere — verificare filtre „acțiune” |
| 4 | Curse + cost combustibil pe o perioadă scurtă; tab **Consum** (segmente L/100km, reconciliere km) |
| 5 | Generare FAZ sau foaie parcurs → descărcare PDF |
| 6 | Login șofer (alt browser) — confirmare că nu poate modifica |
| 7 | Feedback scurt către *[CONTACT]*: ce e util, ce lipsește — ☑ **2026-06**, sinteză §5.1; update **2026-06-21** §5.1 |

### 5.1 Feedback scurt — sinteză (2026-06)

**Stare:** punctul 7 atins cu maturitate — observațiile și ajustările din perioada recentă sunt consolidate aici (nu backlog separat ad-hoc).

| Temă | Ce s-a observat | Răspuns livrat |
|------|-----------------|----------------|
| **Formulare ops (create)** | Context vehicul greu de urmărit; câmpuri critice pierdute în form lung | Layout 40/60: brief vehicul stânga + bandă P1 dreapta (costuri, mentenanță, documente, remindere, curse) |
| **Formulare ops (edit)** | Același UX ca la create; vehicul schimbabil induce confuzie | Layout ops + P1 la edit; **vehicul fixat** (read-only UI, PATCH fără `vehicleId`, API respinge schimbarea) |
| **Profil vehicul** | Lipsă date achiziție și dovezi foto | Taburi **Date achiziție** + **Fotografii** |
| **Mentenanță** | Garanție și daune — câmpuri lipsă în flux operațional | `warrantyRepair`, cost potențial, nr. dosar daună, asigurator |
| **Istoric vehicul (scalare)** | La sute de linii, preview/brief devine limitant | **Neacționat** — de analizat la scalare flotă (nu blocker pilot curent) |
| **Curse / consum** | Consum derivat pe cursă, nu doar agregare alimentări | **Parțial livrat (2026-06-21):** tab Consum — segmente fill-to-fill L/100km, reconciliere km, filtre vehicul/tip energie; km curse din odometru start/final; telemetrie CAN → roadmap §10.1 |
| **Curse — distanță** | Distanță km introdusă manual, desincronizată de odometru | **Livrat:** `distanceKm` calculat automat din odometru start/final (formular + API); PATCH cursă salvează toate câmpurile |
| **Curse — filtre Consum** | Selector vehicule greu de folosit | **Livrat:** filtru collapsible (Alege / Ascunde), chips removable; filtru tip energie după `fuelProductType` alimentări |
| **Curse — calitate date** | L/100km / reconciliere „—” fără explicație | **Livrat:** avertismente calitate + mesaje UI; reconciliere cu fallback citiri → alimentări → curse; **cauză tipică:** km odometru incoerenti pe cost Combustibil (ex. BV34ERT) |
| **Liste ops (scroll + tabele)** | Scroll într-un box mic; header tabel pierdut la derulare; tab-uri remindere se mișcau cu lista | `FleetListPageLayout` — antet + filtre fixe, scroll sub filtre; `FleetDataTable` — header sticky, celule compacte; liste card (documente, mentenanță, remindere) + `.fleet-scroll-pane`; toolbar status remindere fix; eliminat rând debug Vehicule |
| **Liste ops (antet + filtre)** | Zonă fixă antet + filtre ocupă prea mult viewport | **Neacționat** — variantele compact/ops respinse; layout actual păstrat |

**Util pentru client (feedback pozitiv):** modulele ops sunt utilizabile cap-coadă pe 1 vehicul; formularele sunt mai clare; profil vehicul mai complet; tab Consum oferă vizibilitate litri / km / segmente fără alocare litri pe cursă.

**Ce lipsește (transmis / de confirmat cu client):** scalare liste mari, tracking GPS live, **odometru CAN automat** (roadmap §10.1), portal user self-service — conform limitărilor pilot §4.

**Notă calitate date (2026-06-21):** consumul L/100km pe segmente folosește **km odometru de pe alimentări** (nu km din curse). Km trebuie să crească cronologic între alimentări consecutive; altfel media rămâne „—”.

---

## 6. Ce NU predăm în Q3

- Cod sursă / acces GCP / Neon  
- Cont `demo` intern (rămâne pentru echipa noastră)  
- SLA producție — doar pilot staging cu suport best-effort  
- Formare on-site extinsă (opțional separat)

---

## 7. După pilot (orientare)

- Feedback → backlog Q4: **consum combustibil** (continuare §10), CRM, liste mobil, **tracking + odometru CAN** (§10.1)
- **Setări tenant (viitor, alături de useri):** monitorizare km — vehicule cu tracking activ, stare semnal CAN, politică completare odometru (vezi `roadmap-2026-q3-q4.md` §10.1)
- Producție dedicată (URL propriu, backup, SLA) — decizie separată după 8+ săptămâni pilot reușit
- Semnare acceptanță pilot: `go-live-pilot-checklist.md` §7
