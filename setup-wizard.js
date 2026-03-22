#!/usr/bin/env node
/**
 * PresenzaCloud Connector — Setup Wizard
 *
 * Prima esecuzione: attiva il connector con il token generato dall'admin.
 * Se il token è già nel config.json (messo da te prima della visita),
 * l'attivazione è automatica senza che il consulente debba fare nulla.
 */

const https    = require("https");
const http     = require("http");
const fs       = require("fs");
const path     = require("path");
const readline = require("readline");

const CONFIG_PATH = path.join(__dirname, "config.json");

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m",  cyan: "\x1b[36m",  bold: "\x1b[1m",
};

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === "https:" ? https : http;
    const body   = options.body ? JSON.stringify(options.body) : undefined;
    const req    = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || "POST",
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

async function activate(token, apiUrl) {
  process.stdout.write(`\n${C.cyan}Connessione al server...${C.reset} `);
  const url = `${apiUrl}/api/v1/integrations/activate/${token}`;
  let res;
  try { res = await request(url); }
  catch (e) {
    console.log(`${C.red}ERRORE${C.reset}`);
    throw new Error(`Impossibile contattare il server: ${e.message}\nVerifica la connessione internet.`);
  }
  if (res.status === 404) throw new Error("Token non trovato. Verifica di aver copiato il token corretto.");
  if (res.status === 410) throw new Error(res.body?.error ?? "Token già utilizzato o scaduto.");
  if (res.status !== 200) throw new Error(`Errore server (HTTP ${res.status})`);
  process.stdout.write(`${C.green}OK${C.reset}\n`);
  return res.body;
}

async function main() {
  console.clear();
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║  PresenzaCloud Connector — Configurazione ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════╝${C.reset}\n`);

  const config = loadConfig();

  // Già configurato?
  if (config.apiKey) {
    console.log(`${C.green}✓${C.reset} Connector già configurato per: ${C.bold}${config.companyName ?? config.companyId}${C.reset}`);
    console.log(`\nNessuna azione necessaria.\n`);
    console.log("Premi INVIO per chiudere...");
    await new Promise(r => process.stdin.once("data", r));
    return;
  }

  const apiUrl = config.apiUrl ?? "https://backend-production-0f0b8.up.railway.app";

  // Token già nel config (messo prima della visita)?
  let token = config.activationToken ?? null;

  if (token) {
    console.log(`${C.yellow}Token trovato nel file di configurazione.${C.reset}`);
    console.log("Attivazione automatica in corso...\n");
  } else {
    // Chiedi il token manualmente
    console.log(`Benvenuto! Per completare la configurazione hai bisogno del`);
    console.log(`${C.bold}token di attivazione${C.reset} fornito da PresenzaCloud.\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    token = await new Promise(r => {
      rl.question("Inserisci il token di attivazione: ", answer => {
        rl.close(); r(answer.trim());
      });
    });
  }

  if (!token || token.length < 10) {
    console.error(`\n${C.red}✗${C.reset} Token non valido.`);
    process.exit(1);
  }

  let result;
  try {
    result = await activate(token, apiUrl);
  } catch (e) {
    console.error(`\n${C.red}✗ Errore:${C.reset} ${e.message}`);
    console.log("\nPremi INVIO per chiudere...");
    await new Promise(r => process.stdin.once("data", r));
    process.exit(1);
  }

  // Salva config.json definitivo
  const finalConfig = {
    apiKey:      result.apiKey,
    companyId:   result.companyId,
    companyName: result.companyName,
    apiUrl,
    outputPath:  "./output",
    schedule:    "0 23 * * *",
  };
  saveConfig(finalConfig);

  console.log(`\n${C.green}${C.bold}✓ Configurazione completata!${C.reset}\n`);
  console.log(`  Azienda  : ${C.bold}${result.companyName}${C.reset}`);
  console.log(`  API Key  : ${result.apiKey.slice(0, 12)}...`);
  console.log(`\nIl connector è pronto. Per sincronizzare i dati esegui:`);
  console.log(`  ${C.bold}node connector.js${C.reset}\n`);
  console.log("Premi INVIO per chiudere...");
  await new Promise(r => process.stdin.once("data", r));
}

main().catch(e => {
  console.error(`\n${C.red}Errore: ${e.message}${C.reset}`);
  process.exit(1);
});
