====================================================
  PresenzaCloud Connector v1.0.0
  Istruzioni di installazione e utilizzo
====================================================

REQUISITI
---------
- Node.js 18 o superiore (https://nodejs.org)
  → Scarica la versione LTS per Windows
  → Durante l'installazione lascia tutte le opzioni predefinite


PRIMA INSTALLAZIONE (una sola volta)
--------------------------------------
1. Assicurati che Node.js sia installato
   Verifica aprendo il Prompt dei comandi (cmd) e digitando:
     node --version
   Deve apparire qualcosa come: v18.20.5

2. Copia la cartella "PresenzaCloud-Connector" in una
   posizione permanente, ad esempio:
     C:\PresenzaCloud-Connector\

3. Il file config.json contiene già il token di attivazione.
   NON modificarlo.

4. Apri il Prompt dei comandi (cmd) e spostati nella cartella:
     cd C:\PresenzaCloud-Connector

5. Esegui il wizard di configurazione:
     node setup-wizard.js

   Il programma si connetterà al server e configurerà
   automaticamente il connector. Al termine vedrai:
     ✓ Configurazione completata!

6. Testa la connessione:
     node connector.js --test

   Deve apparire il riepilogo dei dipendenti.


UTILIZZO QUOTIDIANO
--------------------
Per scaricare i dati del mese corrente:
  node connector.js

Per scaricare un mese specifico:
  node connector.js --year=2026 --month=3

I file vengono salvati nella cartella "output\":
  - presenzacloud_2026_03_riepilogo.csv       ← riepilogo mensile
  - presenzacloud_2026_03_giornaliero.csv     ← dettaglio per giorno
  - presenzacloud_2026_03_raw.json            ← dati completi (debug)

Il file CSV usa il separatore ";" ed è compatibile con Excel.


AUTOMATIZZAZIONE (opzionale)
------------------------------
Per eseguire il connector automaticamente ogni notte alle 23:00:

1. Apri "Utilità di pianificazione" di Windows (Pianificazione attività)
2. Crea un'attività base
3. Trigger: Ogni giorno alle 23:00
4. Azione: Avvia programma
   Programma: node
   Argomenti: connector.js
   Cartella:  C:\PresenzaCloud-Connector


PROBLEMI COMUNI
----------------
"node non è riconosciuto come comando interno"
  → Node.js non è installato o non è nel PATH
  → Reinstalla Node.js da https://nodejs.org

"Token non trovato"
  → Il token è scaduto (validità 7 giorni)
  → Contatta PresenzaCloud per generare un nuovo token

"Impossibile contattare il server"
  → Verifica la connessione internet
  → Se usi una VPN aziendale, verifica che sia attiva


SUPPORTO
---------
Email: supporto@presenzacloud.it
Web:   https://presenzacloud.it
====================================================
