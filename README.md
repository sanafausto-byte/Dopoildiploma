# Dopo il diploma

Attività orientativa anonima per raccogliere idee sul futuro dopo il diploma. Gli studenti entrano con un codice; il conduttore controlla quando mostrare la seconda domanda e può proiettare le risposte aggregate e le frasi anonime.

## Funzioni

- Risposte anonime, senza richiesta di nomi.
- Prima domanda a risposta libera e visualizzazione dei termini ricorrenti.
- Seconda domanda a scelta multipla, mostrata dal conduttore quando decide.
- Aggiornamento in diretta, conteggi e percentuali.
- Area conduttore protetta da password e modalità di proiezione.

## Architettura

GitHub conserva il codice e può avviare gli aggiornamenti. L’applicazione gira su **Cloudflare Workers** e salva stanze e risposte in **Cloudflare D1**. Perciò non può funzionare come semplice sito statico su GitHub Pages: API e database sono necessari per raccogliere risposte da più telefoni.

## Avvio locale

Servono Node.js 22 o successivo, pnpm e Wrangler. Dalla cartella del progetto:

```bash
pnpm install
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm dev
```

Per abilitare la creazione delle stanze, copia `.dev.vars.example` in `.dev.vars` e imposta `CONDUCTOR_PASSWORD` con la password che vuoi usare per l’area conduttore. `.dev.vars` è escluso da Git.

## Pubblicazione su Cloudflare

1. Crea un database D1: `pnpm exec wrangler d1 create dopo-il-diploma`.
2. Copia il `database_id` restituito nel campo omonimo di `wrangler.jsonc`, al posto dell’ID segnaposto.
3. Applica le migrazioni e pubblica:

   ```bash
   pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.jsonc
   pnpm build
   pnpm deploy
   ```

4. Dopo la prima pubblicazione, imposta la password come secret del Worker:

   ```bash
   pnpm exec wrangler secret put CONDUCTOR_PASSWORD
   ```

   Inseriscila quando Wrangler la richiede. Non salvarla nei file del repository.

## Pubblicazione automatica da GitHub

Il workflow in `.github/workflows/deploy.yml` pubblica a ogni aggiornamento del branch `main`. Nelle impostazioni del repository, aggiungi questi **Actions secrets**:

| Secret | Valore |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token Cloudflare con permessi Workers Scripts: Edit e D1: Edit |
| `CLOUDFLARE_ACCOUNT_ID` | ID dell’account Cloudflare |
| `CF_D1_DATABASE_ID` | ID del database D1 creato al punto 1 |

La password del conduttore va impostata una sola volta con `wrangler secret put CONDUCTOR_PASSWORD`; non è inclusa nel codice pubblico. Dopo aver aggiunto i secrets, avvia il workflow `Deploy` dalla scheda **Actions** oppure fai un nuovo push su `main`.

## Struttura dati

Le migrazioni D1 sono in `drizzle/`. Per generare una nuova migrazione dopo una modifica a `db/schema.ts`, esegui `pnpm db:generate`, poi applicala in locale e su Cloudflare prima di pubblicare.
