# Smoke CRM-017 / PARTNER-024 — field-ops

Tenant `demo`, parolă seed `demo12345`. Un singur dosar, trei loginuri.

- L0 `sofer.alpha@demo.local` · L1 `manager.alpha@demo.local` · R* `partner@alphaservice.local`

## L0 — sofer.alpha

- [ ] Login → `/fleet/tickets`. Lista = create de el, cu `driverId` propriu, sau pe vehicule alocate — nu tot clientul Alpha.
- [ ] Tichet pe vehicul alocat, deschis de altcineva: se deschide.
- [ ] Listă și detaliu: **nu** apar Preia, Rezolvă, Direcționează (claim / resolve / route).
- [ ] Singura transformare: **→ Cursă**. Lipsesc Mentenanță, Cost, Documente.
- [ ] → Cursă reușește; comentariul pe tichet reușește.
- [ ] Fără „Avansează dosar”, fără edit/aprobare deviz, fără patch pe tichet.

## L1 — manager.alpha

- [ ] `/fleet/tickets`: toate tichetele clientului, nu filtrul de vehicule al șoferului.
- [ ] Pe tichet deschis: Preia, Rezolvă, Direcționează L★, → Cursă / Mentenanță / Cost.
- [ ] Programator + dosar lucrare: confirmă programarea (șoferul nu operează dosarul).
- [ ] Editează și **aprobă** devizul. Închide fără `admin@demo.local`.

## R* — portal partener

- [ ] Login → `/fleet/partner` (nu meniul flotă client / tichete CRM).
- [ ] Inbox `/fleet/partner/work-orders`: doar comenzile Alpha Service.
- [ ] WO: status atelier, linii deviz, slot în `/fleet/partner/appointments`.
- [ ] Nu poate claim / resolve / route pe tichetul clientului.

## Dosar cap-coadă

- [ ] L0: tichet nou pe vehicul alocat + mesaj + → Cursă.
- [ ] L1: preia același tichet → programare → confirmă → apare WO → deviz → aprobă.
- [ ] R*: WO-ul e în inbox; actualizează status sau oferta.
- [ ] L1 închide dosarul. L0 reîncarcă tichetul: tot fără butoane moarte claim/resolve/route.
