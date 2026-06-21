## Release & governance – cadenta si ownership

### 1. Cadenta

- Cadenta recomandata: **trimestriala** pentru release-uri majore:
  - R1: Phase 1 MVP (tracking + docs + maintenance core + CRM + portal furnizori minim);
  - R2: Phase 2 Operations Engine;
  - R3: Maintenance & Cost Intelligence.
- Patch-uri lunare:
  - bugfix + mici imbunatatiri UX;
  - fara schimbari de schema breaking.

### 2. Tipuri de release

- `major`:
  - noi module sau modificari de schema;
  - necesita migrari de date si update-uri in Integration Hub.
- `minor`:
  - functionalitati noi backward-compatible;
  - optimizari performanta.
- `patch`:
  - bugfix, security updates, mici imbunatatiri.

### 3. Governance si roluri

> Roluri **aplicație** (tenant, client, platformă): [`identity-access-model.md`](identity-access-model.md). Rolurile de mai jos sunt **organizaționale** (echipa de livrare).

- `Product Owner`:
  - defineste backlog-ul pe baza planului;
  - prioritizeaza epics/stories per release.
- `Tech Lead`:
  - detine arhitectura si alinierea cu platform foundation;
  - aproba design-ul tehnic per epic.
- `Release Manager`:
  - planifica ferestrele de release;
  - coordoneaza testare, rollout, rollback daca este cazul.

### 4. Pipeline de release

1. **Design**:
   - derivare epics/story-uri din plan;
   - specificatii in docs/ si/sau issues.
2. **Implementare**:
   - feature branches;
   - PR-uri cu code review.
3. **Testare**:
   - unit si e2e (Nest, Next);
   - environment `staging` pe GCP (Cloud Run).
4. **Rollout**:
   - staged rollout: intai tenant intern, apoi clienti pilot, apoi general;
   - monitorizare SLO si error budget.

### 5. Riscuri si mitigari

- risc: migrari schema ratate → mitigare: backup punctual + dry-run;
- risc: regressii pe module critice → mitigare: test e2e pe tracking/CRM;
- risc: configuratii tenant corupte → mitigare: versionare config + rollback.

