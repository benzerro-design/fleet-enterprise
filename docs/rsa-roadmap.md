# Roadside Assistance (RSA) — traseu produs

## Stare livrare (cod)

| Fază | Conținut | Status |
|------|----------|--------|
| **S0** | `RsaSupplierProfile`, `RsaPlan`, `RsaVehicleEnrollment`; IAM pe intervenții; UI furnizor + vehicul | Cod gata — necesită `prisma migrate deploy` |
| **S1** | Entitlement `covered \| partial \| out_of_plan \| pay_per_use`; preview API; snapshot pe intervenție; plafon pe an UTC | Cod gata — unit tests OK |
| **S1.5** | Deploy migrări pe Neon | DONE (migrate deploy OK) |
| **S2** | `RsaTowMission` + stări teren + sync intervenție | Cod gata — migrare `20261102160000` |
| **S2b** | PV pickup/dropoff + semnătură ecran + media + PDF | Cod gata — UI ticket + partner `/rsa-missions` |
| **S4** | Settlement `CostEntry` din entitlement snapshot + km + rate card | Cod gata — migrare `20261102200000` |
| **S3** | Offline queue + landscape + QR destinatar | Cod gata (client) |
| **S5** | Broker outbound dispatch + inbound webhook + jurnal evenimente | Cod gata — migrare `20261102220000` |

**Erori cunoscute în cod:** niciun FAIL deschis. S0–S5 livrate; S5 Grok **PASS** (dry_run nu mai promovează status). Riscul principal: lipsă E2E smoke pe caz real.

**Pay-per-use** rămâne first-class: fără înrolare, intervenția e validă cu `pay_per_use`.

---

## Ce lipsește (cerință teren)

Fluxul **șofer platformă RSA**:

1. Ridică mașina de la client în urma solicitării  
2. **Proces-verbal de preluare** (semnături pe ecran — telefon/tabletă)  
3. Transport către service / parcare / alt punct  
4. **Proces-verbal de predare** (semnături pe ecran)  
5. Audit + PDF imutabil  

**Nu există azi.** `MobilityAssignment` are doar upload fișier `handoverProtocolUrl` (loaner), fără semnătură canvas și fără dublu PV de tractare. Nu refolosim acel câmp pentru RSA.

---

## Traseu actualizat

| Fază | Conținut | Prioritate |
|------|----------|------------|
| **S2** | `RsaTowMission` pe intervenție: assign șofer, stări teren (`assigned` → `delivered`), geo/ETA minimal | DONE (cod) |
| **S2b** | `RsaHandoverProtocol` pickup/dropoff + `RsaHandoverSignature` (PNG + strokes) + media + PDF server; UX mobil sign pad; gate pe stări | DONE (cod) |
| **S4** | `POST …/missions/:id/settle` — CostEntry `Asistență rutieră` din snapshot entitlement + km + rate card; preview; idempotent | DONE (cod) |
| **S3** | Offline queue IndexedDB (PV/sign/media/status) + landscape sign pad + QR destinatar | DONE (cod) |
| **S5** | Broker 24×7: profil URL/keys, `POST …/broker-dispatch`, webhook public + `RsaBrokerEvent` | DONE (cod) |

### Reguli S2b (acceptanță)

- ≥2 semnături pe ecran per PV (șofer + client la pickup; șofer + recepție la dropoff)  
- Checklist + foto minime configurabile  
- PDF generat server-side, scoped IAM  
- Landscape touch-first pe semnătură  
- Mobility rămâne doar pentru mașina la schimb  

Detaliu vizual: canvas `rsa-custody-handover-roadmap.canvas.tsx` lângă chat.
