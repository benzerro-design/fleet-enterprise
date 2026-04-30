## Phase 1 MVP – scope executabil

Bazat pe sectiunile „Phase 1 (Must)” si „KPI & criterii de acceptanta (Phase 1)” din plan.

### 1. Tracking vehicule + remorci/semiremorci

- Functionalitati:
  - ingestie pozitie GPS per activ (vehicul, remorca, semiremorca);
  - harta unica cu toate activele filtrabile pe client, status, tip activ;
  - timeline de evenimente (`start`, `stop`, `idle`, `last_seen`) per activ.
- KPI:
  - >95% active raporteaza pozitie in intervalul configurat;
  - latency medie afisare <60 secunde;
  - <2% evenimente GPS invalide/zi.
- Criterii de acceptanta:
  - harta live, timeline, alerte „no signal” peste prag.

### 2. Documente (RCA, CASCO, Certificat inmatriculare, CIV)

- Functionalitati:
  - tipuri documente configurabile per vehicul/sofer/client (cf. rubrica Settings - G);
  - upload + versionare fisier, metadata si status expirare;
  - remindere configurabile pe fiecare tip (60/30/7 zile).
- KPI:
  - 100% active cu set minim de documente obligatorii;
  - >98% acuratete status expirare;
  - reducere cu >70% a documentelor expirate fara notificare.

### 3. ITP

- Functionalitati:
  - campuri ITP in profilul vehiculului (data expirare, statie, documente);
  - calendar ITP + workflow programare/confirmare;
  - legatura cu CRM tickets tip `itp`.
- KPI:
  - 100% vehicule eligibile au data ITP inregistrata;
  - >95% ITP reinnoite inainte de expirare.

### 4. Mentenanta core + reparatii

- Functionalitati:
  - planuri de mentenanta (rubrica Settings - L);
  - work orders generate din plan sau din incidente CRM;
  - statusuri standard si inregistrare piese/manopera/cost.
- KPI:
  - >90% lucrari preventive in interval planificat;
  - MTTR redus cu min. 15%;
  - >95% work orders inchise cu timpi si costuri completate.

### 5. Reparatii pe daune

- Functionalitati:
  - flux dedicat `damage` in CRM;
  - atasare documente (poze, deviz, proces verbal, factura);
  - tracking al aprovarilor si statusurilor dosarului.
- KPI:
  - 100% dosare dauna cu status urmaribil;
  - >90% dosare inchise cu documentatie completa.

### 6. Anvelope (service roti + depozitare)

- Functionalitati:
  - inventar anvelope per vehicul si per depozit;
  - planificare schimburi sezoniere si istoric montaj/demontaj;
  - trasabilitate completa intre vehicul, service roti si depozit.
- KPI:
  - 100% anvelope cu date minime (pozitie, sezon, DOT, uzura);
  - reducere cost anvelope cu min. 10%;
  - >95% schimburi sezoniere finalizate in fereastra planificata.

### 7. Consum carburant (basic)

- Functionalitati:
  - inregistrare alimentari manual/import (data, bon, litri, pret, km; cf. Settings - R);
  - calcul automat consum mediu si dashboard top consumatori;
  - detectie anomalii de baza (praguri de km/consum).
- KPI:
  - >90% alimentari inregistrate corect;
  - acuratete consum mediu in marja +/-5%;
  - detectie anomalii pentru min. 80% cazuri evidente.

### 8. CRM complet (modul M) + portal furnizori minim

- Functionalitati CRM (obligatorii in Phase 1):
  - tipuri ticket, workflow, SLA, auto-prioritizare P1–P4;
  - auto-routing (cel putin regulile de baza pe tip + client);
  - cost approval matrix simplificat (T1/T2/T3).
- Portal furnizori minim:
  - autentificare furnizor;
  - inbox lucrari (work orders) si actualizare status;
  - atasamente si oferte pe linii (piese, manopera);
  - inchidere cu factura + export metadata cost catre modul financiar.

