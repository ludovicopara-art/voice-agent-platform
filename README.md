# Piattaforma Multi-Tenant — Segretaria Vocale AI

Questa è la versione "prodotto" del progetto: un solo server gestisce N clienti
(ristoranti, studi dentistici, ecc.), ognuno con il proprio numero Twilio, i
propri orari, e il proprio Google Calendar collegato via OAuth.

## Come funziona

1. **Tu** crei un nuovo cliente da `/onboarding.html` (nome attività, orari,
   indirizzo, numero Twilio assegnato).
2. Il sistema genera un **link di collegamento Google Calendar** per quel
   cliente: lui lo apre, fa login con il suo account Google, autorizza
   l'accesso al calendario. Il refresh token viene salvato **cifrato** nel
   database, legato a lui.
3. Quando arriva una chiamata, Twilio dice al server **su quale numero è
   arrivata** (`req.body.To`). Il server cerca nel database quale cliente
   possiede quel numero, e usa i SUOI dati (orari, calendario, prompt) per
   gestire la conversazione.
4. Un cliente non vede né tocca mai i dati di un altro cliente: sono righe
   separate nella tabella `Tenant`, isolate dal codice.

## Cosa devi usare (riepilogo)

| Componente | Strumento | Perché |
|---|---|---|
| Database | **PostgreSQL** (Supabase, Railway o Neon — tutti hanno un piano gratuito iniziale) | Salva i dati di ogni cliente |
| ORM | **Prisma** | Gestisce lo schema (`prisma/schema.prisma`) e le query in modo sicuro |
| Autenticazione calendario | **OAuth2 Google** (non più service account) | Ogni cliente collega il proprio calendario da solo |
| Cifratura | Modulo nativo `crypto` di Node (AES-256-GCM) | Protegge i refresh token nel database |
| Hosting | Render, Railway o Fly.io | Fa girare il server 24/7 |
| Telefonia | Twilio (account tuo, un numero per cliente) | Riceve le chiamate e le instrada al webhook |

## Setup

```bash
npm install
cp .env.example .env   # compila con le tue credenziali
```

### 1. Crea il progetto OAuth su Google Cloud (una volta sola, è tuo)

- Vai su Google Cloud Console → crea un progetto
- Abilita la "Google Calendar API"
- Crea credenziali OAuth 2.0 di tipo "Applicazione web"
- Redirect URI autorizzato: `https://tua-piattaforma.it/oauth/google/callback`
- Copia Client ID e Client Secret in `.env`

**Nota importante**: finché l'app OAuth è in modalità "Test" su Google Cloud,
solo gli utenti che aggiungi manualmente come "test user" potranno autorizzarla.
Per usarla con clienti reali dovrai passare l'app in produzione (Google richiede
una verifica se usi lo scope completo di Calendar — pianifica questo passaggio
per tempo, può richiedere alcuni giorni).

### 2. Genera la chiave di cifratura

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Incollala in `ENCRYPTION_KEY` nel `.env`.

### 3. Crea il database

```bash
npx prisma migrate dev --name init
```

### 4. Avvia

```bash
npm start
```

Vai su `https://tua-piattaforma.it/onboarding.html` per creare il primo cliente di prova.

## Cosa manca ancora prima di vendere sul serio

Questo scaffold ti dà la base tecnica corretta, ma per un vero prodotto commerciale servono ancora:

1. **Autenticazione admin vera**: le rotte `/admin/*` oggi usano solo una chiave
   condivisa (`ADMIN_API_KEY`). Va bene per iniziare da solo, ma prima di avere
   un team o un pannello pubblico serve un vero sistema di login (es. Auth0,
   Clerk, o NextAuth se passi a un frontend React).
2. **Dashboard per il cliente finale**: oggi solo tu puoi creare/modificare un
   tenant. I tuoi clienti vorranno vedere le proprie prenotazioni e magari
   modificare orari da soli — serve un login per loro e una UI dedicata.
3. **Acquisto automatico del numero Twilio**: oggi assumi che il numero
   esista già. Con l'API `IncomingPhoneNumbers` di Twilio puoi automatizzare
   l'acquisto quando un cliente si registra (attenzione: comporta un costo,
   quindi va fatto solo dopo un pagamento confermato).
4. **Fatturazione**: integra Stripe (abbonamenti ricorrenti) per far pagare
   il canone mensile automaticamente, invece di gestirlo a mano.
5. **Isolamento dei costi Twilio/Claude per cliente**: se vuoi rivendere
   anche il consumo (minuti, token), valuta i **Twilio Subaccounts** — un
   sub-account per cliente ti dà fatture Twilio separate e limiti di spesa
   indipendenti.
6. **Monitoraggio**: un servizio come Sentry (errori) o UptimeRobot
   (disponibilità) ti avvisa se il server si blocca prima che se ne accorga
   un cliente.
7. **Contratti e conformità GDPR**: un DPA (Data Processing Agreement) da far
   firmare a ogni cliente, e termini di servizio chiari — soprattutto se
   servi studi medici/dentistici (dati sanitari = categoria particolare).
8. **Gestione "sposta"/"cancella"**: nello scaffold attuale è implementato
   solo l'intent "prenota" nel flusso principale; va aggiunta la ricerca
   dell'appuntamento esistente (per numero di telefono, salvato negli
   `extendedProperties` dell'evento) per gli altri due intent.

## Suggerimento sull'ordine

Con un solo cliente pilota, puoi anche saltare i punti 2-6 all'inizio e
gestirli manualmente (tu crei il tenant, tu controlli le prenotazioni per
lui). Automatizza man mano che il numero di clienti cresce e diventa
insostenibile farlo a mano — non prima, per non perdere tempo a costruire
infrastruttura che non ti serve ancora.
