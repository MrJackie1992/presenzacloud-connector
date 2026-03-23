#!/usr/bin/env node
/**
 * PresenzaCloud Connector — Setup Wizard v2.0.0
 *
 * Attiva il connector con lo studio_token generato dal backend.
 * Al termine salva config.json con studioToken + lista aziende iniziale.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const CONFIG_PATH = path.join(__dirname, "config.json");

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m", cyan: "\x1b[36m", bold: "\x1b[1m",
};

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return {}; }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

async function activate(studioToken, apiUrl) {
  process.stdout.write(`\n${C.cyan}Connessione al server...${C.reset} `);
  const url = `${apiUrl}/api/v1/integrations/activate/${studioToken}`;
  let res;
  try { res = await request(url); }
  catch (e) {
    console.log(`${C.red}ERRORE${C.reset}`);
    throw new Error(`Impossibile contattare il server: ${e.message}\nVerifica la connessione internet.`);
  }
  if (res.status === 404) throw new Error("Token non trovato. Verifica di aver copiato il token corretto.");
  if (res.status !== 200) throw new Error(`Errore server (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
  process.stdout.write(`${C.green}OK${C.reset}\n`);
  return res.body; // { ok, studioToken, studioName, companies, apiUrl }
}

async function main() {
  console.clear();
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║  PresenzaCloud Connector — Configurazione ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════╝${C.reset}\n`);

  const config = loadConfig();

  // Già configurato?
  if (config.studioToken) {
    console.log(`${C.green}✓${C.reset} Connector già configurato per: ${C.bold}${config.studioName ?? "Studio"}${C.reset}`);
    const companies = config.companies ?? [];
    if (companies.length > 0) {
      console.log(`\nAziende collegate (${companies.length}):`);
      for (const c of companies) {
        console.log(`  • ${c.companyName}`);
      }
    }
    console.log(`\nNessuna azione necessaria.`);
    console.log(`\nSe è stata aggiunta una nuova azienda, esegui:`);
    console.log(`  ${C.bold}node connector.js${C.reset}\n`);
    console.log("Premi INVIO per chiudere...");
    await new Promise(r => process.stdin.once("data", r));
    return;
  }

  const apiUrl = config.apiUrl ?? "https://backend-production-0f0b8.up.railway.app";
  let studioToken = config.studioToken ?? null;

  if (studioToken) {
    console.log(`${C.yellow}Token trovato nel file di configurazione.${C.reset}`);
    console.log("Attivazione automatica in corso...\n");
  } else {
    console.log(`Per completare la configurazione hai bisogno del`);
    console.log(`${C.bold}token di attivazione${C.reset} fornito da PresenzaCloud.\n`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    studioToken = await new Promise(r => {
      rl.question("Inserisci il token di attivazione: ", answer => {
        rl.close(); r(answer.trim());
      });
    });
  }

  if (!studioToken || studioToken.length < 10) {
    console.error(`\n${C.red}✗${C.reset} Token non valido.`); process.exit(1);
  }

  let result;
  try { result = await activate(studioToken, apiUrl); }
  catch (e) {
    console.error(`\n${C.red}✗ Errore:${C.reset} ${e.message}`);
    console.log("\nPremi INVIO per chiudere...");
    await new Promise(r => process.stdin.once("data", r));
    process.exit(1);
  }

  // Salva config con studioToken (le aziende si scaricano dinamicamente ad ogni run)
  const finalConfig = {
    studioToken: result.studioToken,
    studioName: result.studioName,
    apiUrl,
    outputPath: "./output",
    schedule: "0 23 * * *",
  };
  saveConfig(finalConfig);

  console.log(`\n${C.green}${C.bold}✓ Configurazione completata!${C.reset}\n`);
  console.log(`  Studio   : ${C.bold}${result.studioName}${C.reset}`);
  console.log(`  Aziende  : ${result.companies?.length ?? 0} collegata/e`);
  if (result.companies?.length > 0) {
    for (const c of result.companies) {
      console.log(`             • ${c.companyName}`);
    }
  }
  console.log(`\nEsegui il connector con:`);
  console.log(`  ${C.bold}node connector.js${C.reset}\n`);
  console.log("Premi INVIO per chiudere...");
  await new Promise(r => process.stdin.once("data", r));
}

main().catch(e => {
  console.error(`\n${C.red}Errore: ${e.message}${C.reset}`);
  process.exit(1);
});
