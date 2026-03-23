#!/usr/bin/env node
/**
 * PresenzaCloud Connector v2.0.0 — Multi-company
 *
 * Scarica i dati di TUTTE le aziende dello studio e genera CSV separati.
 * La lista aziende viene aggiornata automaticamente ad ogni avvio —
 * se il consulente acquisisce un nuovo cliente su PresenzaCloud,
 * il connector lo includerà automaticamente senza reinstallazione.
 *
 * Uso:
 *   node connector.js              → mese corrente, tutte le aziende
 *   node connector.js --test       → test connessione (no file)
 *   node connector.js --year=2026 --month=3
 *   node connector.js --company=uuid  → solo un'azienda specifica
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "config.json");

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m", cyan: "\x1b[36m", bold: "\x1b[1m", gray: "\x1b[90m",
};
const log = (m) => console.log(`${C.gray}[${new Date().toISOString()}]${C.reset} ${m}`);
const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`);
const err = (m) => console.log(`${C.red}✗${C.reset} ${m}`);
const info = (m) => console.log(`${C.cyan}ℹ${C.reset} ${m}`);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    err("File config.json non trovato.");
    info("Esegui prima: node setup-wizard.js");
    process.exit(1);
  }
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch (e) { err(`config.json non valido: ${e.message}`); process.exit(1); }
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
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

// Scarica la lista aggiornata di aziende dallo studio
async function fetchStudioConfig(config) {
  const url = `${config.apiUrl}/api/v1/integrations/studio-config/${config.studioToken}`;
  const res = await request(url);
  if (res.status === 404) {
    err("Studio non trovato. Il token potrebbe essere non valido.");
    process.exit(1);
  }
  if (res.status !== 200) {
    err(`Errore configurazione studio (HTTP ${res.status})`);
    process.exit(1);
  }
  return res.body; // { studioName, companies: [{companyId, companyName, apiKey}] }
}

// Scarica i dati mensili di una singola company
async function fetchCompanyData(config, company, year, month) {
  const url = `${config.apiUrl}/api/v1/payroll/pull/monthly?year=${year}&month=${month}`;
  const res = await request(url, { headers: { "X-Api-Key": company.apiKey } });
  if (res.status === 401) {
    warn(`API Key non valida per ${company.companyName} — saltata`);
    return null;
  }
  if (res.status !== 200) {
    warn(`Errore API per ${company.companyName} (HTTP ${res.status}) — saltata`);
    return null;
  }
  return res.body;
}

function toRiepilogoCsv(data, year, month) {
  const h2 = (m) => m == null ? "0.00" : (m / 60).toFixed(2);
  const lines = [
    "BADGE;COGNOME;NOME;MATRICOLA_PAGHE;ANNO;MESE;ORE_ORDINARIE;ORE_STRAORDINARIE;" +
    "ORE_NOTTURNE;GIORNI_PRESENTI;FERIE_GG;MALATTIA_GG;PERMESSO_GG;TIMBR_MANCANTI;ORE_CONTRATTO;DIFF_ORE",
  ];
  for (const e of data.employees ?? []) {
    lines.push([
      e.badge ?? "", e.lastName ?? "", e.firstName ?? "",
      e.payrollExternalId ?? "", year, month,
      h2(e.totaleMinutiOrdinari), h2(e.straordinariMinuti), h2(e.oreNotturneMinuti),
      e.giorniPresenti ?? 0, e.ferieGiorni ?? 0, e.malattiaGiorni ?? 0,
      e.permessoGiorni ?? 0, e.timbratureMancanti ?? 0,
      h2(e.oreContrattoMensiliMinuti), h2(e.diffOreMinuti),
    ].join(";"));
  }
  return lines.join("\r\n");
}

function toDettaglioCsv(data) {
  const h2 = (m) => m == null ? "" : (m / 60).toFixed(2);
  const lines = ["BADGE;COGNOME;NOME;DATA;ORE_LAVORATE;STRAORDINARI;ORE_NOTTURNE;ASSENZA;NOTE"];
  for (const e of data.employees ?? []) {
    for (const d of e.giorni ?? []) {
      lines.push([
        e.badge ?? "", e.lastName ?? "", e.firstName ?? "", d.date ?? "",
        h2(d.totalWorkedMinutes), h2(d.overtimeMinutes),
        h2(d.nightMinutes), d.absenceType ?? "", d.flags ?? "",
      ].join(";"));
    }
  }
  return lines.join("\r\n");
}

function writeCompanyOutput(baseDir, companyName, data, year, month) {
  // Cartella per azienda: output/AziendaRossi/
  const safeName = companyName.replace(/[^a-zA-Z0-9À-ÿ\s]/g, "").trim().replace(/\s+/g, "_");
  const dir = path.join(baseDir, safeName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const pad = (n) => String(n).padStart(2, "0");
  const pfx = `presenzacloud_${year}_${pad(month)}`;

  fs.writeFileSync(path.join(dir, `${pfx}_raw.json`), JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, `${pfx}_riepilogo.csv`), toRiepilogoCsv(data, year, month), "utf8");
  fs.writeFileSync(path.join(dir, `${pfx}_giornaliero.csv`), toDettaglioCsv(data), "utf8");

  return dir;
}

function printCompanySummary(companyName, data, year, month) {
  const emps = data.employees ?? [];
  console.log(`\n  ${C.bold}${C.cyan}${companyName}${C.reset} — ${emps.length} dipendenti`);
  for (const e of emps) {
    const ore = e.totaleMinutiOrdinari != null ? (e.totaleMinutiOrdinari / 60).toFixed(1) : "—";
    const stra = e.straordinariMinuti ? ` +${(e.straordinariMinuti / 60).toFixed(1)}h str.` : "";
    const ass = [
      e.ferieGiorni ? `${e.ferieGiorni}gg ferie` : null,
      e.malattiaGiorni ? `${e.malattiaGiorni}gg mal.` : null,
      e.permessoGiorni ? `${e.permessoGiorni}gg perm.` : null,
    ].filter(Boolean).join(", ");
    console.log(
      `    ${C.cyan}${(e.lastName + " " + e.firstName).padEnd(25)}${C.reset}` +
      `${C.bold}${(ore + "h").padStart(7)}${C.reset}${stra.padEnd(12)}` +
      (ass ? `  ${C.yellow}${ass}${C.reset}` : "") +
      (e.timbratureMancanti ? `  ${C.red}⚠ ${e.timbratureMancanti} mancanti${C.reset}` : "")
    );
  }
}

async function main() {
  console.log(`\n${C.bold}${C.cyan}PresenzaCloud Connector v2.0.0${C.reset}\n`);

  const args = process.argv.slice(2);
  const isTest = args.includes("--test");
  const yearArg = args.find(a => a.startsWith("--year="));
  const monArg = args.find(a => a.startsWith("--month="));
  const companyArg = args.find(a => a.startsWith("--company="));

  const now = new Date();
  const year = yearArg ? parseInt(yearArg.split("=")[1]) : now.getFullYear();
  const month = monArg ? parseInt(monArg.split("=")[1]) : now.getMonth() + 1;

  const config = loadConfig();
  if (!config.studioToken) {
    err("Connector non configurato."); info("Esegui: node setup-wizard.js"); process.exit(1);
  }

  info(`Studio  : ${config.studioName ?? "—"}`);
  info(`Periodo : ${month}/${year}`);
  if (isTest) info("Modalità TEST — nessun file verrà scritto\n");

  // Scarica configurazione aggiornata (include nuove aziende aggiunte dopo l'installazione)
  log("Aggiornamento configurazione studio...");
  let studioConfig;
  try {
    studioConfig = await fetchStudioConfig(config);
  } catch (e) {
    err(`Errore di rete: ${e.message}`); process.exit(1);
  }

  let companies = studioConfig.companies ?? [];
  ok(`${companies.length} aziend${companies.length === 1 ? "a" : "e"} collegate allo studio`);

  // Filtra per azienda specifica se richiesto
  if (companyArg) {
    const companyId = companyArg.split("=")[1];
    companies = companies.filter(c => c.companyId === companyId);
    if (companies.length === 0) { err(`Azienda ${companyId} non trovata`); process.exit(1); }
  }

  if (companies.length === 0) {
    warn("Nessuna azienda collegata allo studio.");
    return;
  }

  const outputBase = path.resolve(__dirname, config.outputPath ?? "./output");
  console.log("\n" + "─".repeat(62));
  console.log(`${C.bold}RIEPILOGO ${month}/${year}${C.reset}`);
  console.log("─".repeat(62));

  let success = 0;
  for (const company of companies) {
    log(`Download ${company.companyName}...`);
    let data;
    try {
      data = await fetchCompanyData(config, company, year, month);
    } catch (e) {
      warn(`Errore di rete per ${company.companyName}: ${e.message}`);
      continue;
    }
    if (!data) continue;

    const count = (data.employees ?? []).length;
    if (count === 0) {
      warn(`${company.companyName}: nessun dato per ${month}/${year}`);
      continue;
    }

    printCompanySummary(company.companyName, data, year, month);

    if (!isTest) {
      const dir = writeCompanyOutput(outputBase, company.companyName, data, year, month);
      ok(`File → ${dir}`);
    }
    success++;
  }

  console.log("─".repeat(62));
  if (isTest) {
    ok(`Test completato — ${success}/${companies.length} aziende raggiungibili`);
  } else {
    ok(`Sincronizzazione completata — ${success}/${companies.length} aziende`);
    info(`File in: ${C.bold}${outputBase}${C.reset}`);
  }
}

main().catch(e => { err(`Errore fatale: ${e.message}`); process.exit(1); });
