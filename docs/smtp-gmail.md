# SMTP Gmail — staging (Fleet API)

Mailurile de daună (avizare, reconstatare, deviz) și notificările partener folosesc
`PartnerMailService`. Fără `SMTP_HOST` + `SMTP_FROM`, statusul rămâne **stubbed**.

În UI: **Setup → Email** (From afișat, Reply-To, semnătură, CC membri). Envelope-ul
rămâne `SMTP_FROM` — setările tenant nu înlocuiesc autentificarea Gmail.

## 1. Parolă pentru aplicații (Gmail)

1. Cont Google cu **verificare în 2 pași** activă.
2. [Parole pentru aplicații](https://myaccount.google.com/apppasswords) → generează una (ex. „Fleet SMTP”).
3. Copiază parola de 16 caractere (poți lăsa spațiile).

## 2. Valori

| Variabilă | Valoare tipică |
|-----------|----------------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `adresa.ta@gmail.com` |
| `SMTP_PASS` | parola de aplicație |
| `SMTP_FROM` | aceeași adresă ca `SMTP_USER` |

Port `587` + `SMTP_SECURE=false` e suportat (STARTTLS).

## 3. Local (`api/.env`)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=adresa.ta@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=adresa.ta@gmail.com
```

Restart Nest, apoi **Trimite avizare** pe un dosar — în log trebuie `sent`, nu `stubbed`.

## 4. Staging (GitHub Secrets → Cloud Run)

GitHub → **Settings → Secrets and variables → Actions** — adaugă:

| Secret | Valoare |
|--------|---------|
| `SMTP_FROM` | `adresa.ta@gmail.com` |
| `SMTP_USER` | aceeași adresă |
| `SMTP_PASS` | parola de aplicație |

Workflow-ul setează pe Cloud Run host Gmail (`465` / secure) + aceste secrete.
Fără ele, deploy-ul **trece**, iar mailurile rămân `stubbed`.

După deploy reușit, pe un dosar: status mail **sent**.

## 5. Atașamente binare

Avizare / reconstatare / deviz descarcă fișierele de pe `WEB_ORIGIN` (ex. `/uploads/documents/...`)
și le trimit ca **atașamente MIME** (max ~8 MB/fișier, ~20 MB total). Linkurile rămân în body ca rezervă.

Dacă un fișier nu poate fi descărcat (404 după redeploy web fără volum persistent), mailul pleacă tot
cu linkuri — verifică că upload-urile sunt accesibile public pe URL-ul web.
