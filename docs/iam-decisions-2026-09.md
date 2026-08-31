# IAM — decizii produs (1 sep 2026)

**Statut:** decizii blocate în chat; implementare via **IAM-002**, **IAM-003**, **IAM-008**.  
**Canonic general:** `identity-access-model.md` (terminologie, straturi). Acest fișier = **reguli operaționale** pentru creare useri / R / drepturi fine.

**Naming:** Abonat = tenant (SaaS). **Client** = organizație contractuală în tenant. Nu denumi nodul de tenant „Admin”.

---

## 1. Ierarhie (notație L / R)

| Nivel | Rol | Cine |
|-------|-----|------|
| **L\*\*** | Vendor / platform | Poate orice (override global) |
| **L\*** | Admin abonat (tenant) | Echipa flotei care a cumpărat SaaS |
| **L1** | User pe client | Manager / dispecer pe un Client |
| **R\*** | Owner cont furnizor | Portal partener |
| **R1** | Operator furnizor | Recepție / atelier / facturare |
| **R0** | Read-only furnizor | Vede, nu editează |

---

## 2. Cine creează pe cine

| Creator | Poate crea |
|---------|------------|
| **L\*\*** | **L\*** (și orice override) |
| **L\*** | **L1**, **R\*** |
| **L1** | Echipa pe **clientul lui** (alți L1 / șoferi etc.) |
| **R\*** | **R1**, **R0** pe atelierul lui |
| **L\*** / **L\*\*** | Override oricând pe L1 / R |

Self-service pe L1 și R\* e **da**. Invite UI = **IAM-002**. Abonat nou din UI = după ce invite L\* merge (până la al 2-lea plătitor: seed OK).

---

## 3. Profile F / T / G

- Pe **L\*** și **L1** (job profiles pe flotă).
- **Nu** pe axa **R** (portal atelier: R\* / R1 / R0 + opțional staff vs accountant — fără etichetă F/T/G).

---

## 4. Furnizori ↔ clienți

- **L\*** creează furnizorul și **îl alocă** clientului.
- **L1** folosește doar furnizorii alocați (vizibilitate = alocare).
- Opțional mai târziu: „propune furnizor” de la L1 (nu în coada activă).

Backlog: **UAT-010**, **UAT-011**.

---

## 5. Drepturi fine pe client (setări)

**L\*** / **L\*\*** bifează pe **setările clientului** ce poate L1:

- OCR (CIV / documente pe vehiculele clientului)
- Date achiziție
- Altele similare (extensibil)

Default: **conservator** (dezactivat până la grant).  
Backlog: **IAM-008**, **UAT-001**, **UAT-007**.

---

## 6. Tracking backlog

Un singur index: canvas **fleet-backlog-master** (nu Linear). Coadă activă max ~5–7.
