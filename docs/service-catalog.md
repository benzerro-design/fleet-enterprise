## Catalog servicii enterprise si mapare pe faze

Bazat pe sectiunile „Catalog servicii oferite (business scope)” si „Grupare servicii pe faze”.

### 1. Servicii principale

- Tracking vehicule, remorci, semiremorci.
- Mentenanta si reparatii.
- Gestionare documente (RCA, CASCO, CIV, certificat inmatriculare etc.).
- Anvelope (service roti + depozitare).
- ITP.
- Reparatii pe daune.
- Tahograf + foi de parcurs + CMR.
- Asistenta rutiera.
- Vignette/eTransport/eToll.
- Servicii RAR, DITL, DRPCIV.
- Monitorizare cargo (temperatura, umiditate, usi, greutate estimata).
- Consum carburant.

### 2. Mapare pe faze (rezumat executabil)

- **Phase 1 (Must)**:
  - tracking vehicule + remorci/semiremorci;
  - documente;
  - ITP;
  - mentenanta si reparatii (core workflows);
  - reparatii daune;
  - anvelope (service roti + depozitare);
  - consum carburant (basic);
  - UI EN/RO/DE;
  - CRM complet + supplier portal minim (cf. `phase1-mvp-scope.md`).

- **Phase 2 (Should/Must extins)**:
  - tahograf, foi de parcurs, CMR;
  - asistenta rutiera;
  - vignette/eTransport/eToll;
  - RAR, DITL, DRPCIV;
  - senzori usi;
  - monitorizare temperatura/umiditate cargo;
  - estimare greutate pe axa (post-validare).

### 3. Pachete comerciale (tracking + fleet management)

Conform rubricii Settings - S:

- tracking ca serviciu de baza pe tip vehicul (turism, van, cap tractor, remorca, semiremorca);
- pachete `T+P1`, `T+P2`, `T+P3` pe tip vehicul:
  - continutul exact al pachetelor se defineste in modul de tarifare, dar structura si codurile pachetelor sunt pregatite aici;
- add-on-uri:
  - temperatura/umiditate cargo,
  - monitorizare usi,
  - monitorizare sofer,
  - comenzi de la distanta,
  - monitorizare consum carburant,
  - estimare greutate pe axa.

Acest catalog serveste ca baza pentru configurarea comerciala detaliata si pentru modulele de tracking, mentenanta, documente, asistenta si financiar.

