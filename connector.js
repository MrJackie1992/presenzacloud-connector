#!/usr/bin/env node
/**
 * PresenzaCloud Connector v1.0.0
 *
 * Scarica i dati mensili dal cloud PresenzaCloud e li salva in CSV.
 *
 * Uso:
 *   node connector.js              → mese corrente
 *   node connector.js --test       → test connessione (no file)
 *   node connector.js --year=2026 --month=3
 */

const https    = require("https");
const http     = require("http");
const fs       = require("fs");
const path     = require("path");

const CONFIG_PATH = path.join(__dirname, "config.json");

const C = {
  reset:  "\x1b[0m",  green:  "\x1b[32m", yellow: "\x1b[33m",
  red:    "\x1b[31m", cyan:   "\x1b[36m", bold:   "\x1b[1m",
};
const log  = (m) => console.log(`\x1b[90m[${new Date().toISOString()}]\x1b[0m ${m}`);
const ok   = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`);
const err  = (m) => console.log(`${C.red}✗${C.reset} ${m}`);
const info = (m) => console.log(`${C.cyan}ℹ${C.reset} ${m}`);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    err("File config.json non trovato.");
    info("Esegui prima: node setup-wizard.js");
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    err(`config.json non è un JSON valido: ${e.message}`);
    process.exit(1);
  }
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === "https:" ? https : http;
    const body   = options.body ? JSON.stringify(options.body) : undefined;
    const req    = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || "GET",
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

async function fetchData(config, year, month) {
  const url = `${config.apiUrl}/api/v1/payroll/pull/monthly?year=${year}&month=${month}`;
  log(`Download dati ${month}/${year}...`);
  const res = await request(url, { headers: { "X-Api-Key": config.apiKey } });
  if (res.status === 401) { err("API Key non valida."); process.exit(1); }
  if (res.status !== 200) { err(`Errore API HTTP ${res.status}`); process.exit(1); }
  return res.body;
}

function toRiepilogoCsv(data, year, month) {
  const h2 = (m) => m == null ? "0.00" : (m / 60).toFixed(2);
  const lines = [
    "BADGE;COGNOME;NOME;MATRICOLA_PAGHE;ANNO;MESE;ORE_ORDINARIE;ORE_STRAORDINARIE;" +
    "ORE_NOTTURNE;GIORNI_PRESENTI;FERIE_GG;MALATTIA_GG;PERMESSO_GG;" +
    "TIMBR_MANCANTI;ORE_CONTRATTO;DIFF_ORE",
  ];
  for (const e of data.employees ?? []) {
    lines.push([
      e.badge ?? "", e.lastName ?? "", e.firstName ?? "",
      e.payrollExternalId ?? "", year, month,
      h2(e.totaleMinutiOrdinari), h2(e.straordinariMinuti),
      h2(e.oreNotturneMinuti), e.giorniPresenti ?? 0,
      e.ferieGiorni ?? 0, e.malattiaGiorni ?? 0, e.permessoGiorni ?? 0,
      e.timbratureMancanti ?? 0,
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

function writeOutput(config, data, year, month) {
  const dir = path.resolve(__dirname, config.outputPath ?? "./output");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const pad = (n) => String(n).padStart(2, "0");
  const pfx = `presenzacloud_${year}_${pad(month)}`;

  fs.writeFileSync(path.join(dir, `${pfx}_raw.json`),        JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, `${pfx}_riepilogo.csv`),   toRiepilogoCsv(data, year, month), "utf8");
  fs.writeFileSync(path.join(dir, `${pfx}_giornaliero.csv`), toDettaglioCsv(data), "utf8");
  ok(`File salvati in: ${C.bold}${dir}${C.reset}`);
  return dir;
}

function printSummary(data, year, month) {
  const emps = data.employees ?? [];
  console.log("\n" + "─".repeat(62));
  console.log(`${C.bold}RIEPILOGO ${month}/${year}${C.reset} — ${emps.length} dipendenti`);
  console.log("─".repeat(62));
  for (const e of emps) {
    const ore  = e.totaleMinutiOrdinari != null ? (e.totaleMinutiOrdinari / 60).toFixed(1) : "—";
    const stra = e.straordinariMinuti ? ` +${(e.straordinariMinuti / 60).toFixed(1)}h str.` : "";
    const ass  = [
      e.ferieGiorni    ? `${e.ferieGiorni}gg ferie`   : null,
      e.malattiaGiorni ? `${e.malattiaGiorni}gg mal.`  : null,
      e.permessoGiorni ? `${e.permessoGiorni}gg perm.` : null,
    ].filter(Boolean).join(", ");
    console.log(
      `  ${C.cyan}${(e.lastName + " " + e.firstName).padEnd(25)}${C.reset}` +
      `${C.bold}${(ore + "h").padStart(7)}${C.reset}${stra.padEnd(12)}` +
      (ass ? `  ${C.yellow}${ass}${C.reset}` : "") +
      (e.timbratureMancanti ? `  ${C.red}⚠ ${e.timbratureMancanti} mancanti${C.reset}` : "")
    );
  }
  console.log("─".repeat(62) + "\n");
}

async function main() {
  console.log(`\n${C.bold}${C.cyan}PresenzaCloud Connector v1.0.0${C.reset}\n`);
  const args    = process.argv.slice(2);
  const isTest  = args.includes("--test");
  const yearArg = args.find(a => a.startsWith("--year="));
  const monArg  = args.find(a => a.startsWith("--month="));
  const now     = new Date();
  const year    = yearArg ? parseInt(yearArg.split("=")[1]) : now.getFullYear();
  const month   = monArg  ? parseInt(monArg.split("=")[1])  : now.getMonth() + 1;

  const config = loadConfig();
  if (!config.apiKey) {
    err("Connector non ancora attivato."); info("Esegui: node setup-wizard.js"); process.exit(1);
  }

  info(`Azienda : ${config.companyName ?? config.companyId}`);
  info(`Periodo : ${month}/${year}`);
  if (isTest) info("Modalità TEST — nessun file verrà scritto\n");

  let data;
  try { data = await fetchData(config, year, month); }
  catch (e) { err(`Errore di rete: ${e.message}`); process.exit(1); }

  const count = (data.employees ?? []).length;
  ok(`Dati ricevuti: ${count} dipendenti`);

  if (count === 0) { warn("Nessun dato per questo mese."); return; }

  printSummary(data, year, month);

  if (!isTest) writeOutput(config, data, year, month);
  else ok("Test completato — connessione al server OK");
}

main().catch(e => { err(`Errore: ${e.message}`); process.exit(1); });
