# PresenzaCloud Connector

Agent locale per la sincronizzazione automatica con il software paghe.

## Requisiti

- Node.js 18+ (https://nodejs.org)
- Connessione internet
- Token di attivazione generato dall'admin

## Installazione rapida

1. Scarica e installa Node.js da https://nodejs.org/en/download (versione LTS)
2. Copia la cartella `presenzacloud-connector` sul PC
3. Apri `config.json` con Blocco Note e incolla il token di attivazione
4. Apri il Terminale (cmd o PowerShell) nella cartella
5. Esegui:

```
node connector.js --activate
```

## Comandi disponibili

```bash
# Prima attivazione (una volta sola)
node connector.js --activate

# Test connessione (non scrive file)
node connector.js --test

# Sincronizza mese corrente
node connector.js

# Sincronizza mese specifico
node connector.js --year=2026 --month=3
```

## Output

I file vengono salvati nella cartella `output/`:

- `presenzacloud_2026_03_raw.json`         — dati completi in formato JSON
- `presenzacloud_2026_03_riepilogo.csv`    — riepilogo mensile per dipendente
- `presenzacloud_2026_03_dettaglio_giornaliero.csv` — dettaglio giorno per giorno

## Formato CSV riepilogo

Colonne: BADGE; COGNOME; NOME; MATRICOLA_PAGHE; ANNO; MESE; ORE_ORDINARIE;
ORE_STRAORDINARIE; ORE_NOTTURNE; GIORNI_PRESENTI; FERIE_GG; MALATTIA_GG;
PERMESSO_GG; TIMBR_MANCANTI; ORE_CONTRATTO; DIFF_ORE

⚠️  Il formato CSV verrà adattato al tracciato record di Ranocchi dopo
la prima visita al consulente. Per ora serve per verificare che i dati
siano corretti.

## Aggiornare il config dopo l'attivazione

Una volta attivato, `config.json` conterrà la `apiKey` permanente.
Non è necessario rigenerare il token — funziona finché la company
è attiva su PresenzaCloud.
