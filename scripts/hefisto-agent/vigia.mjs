#!/usr/bin/env node
// VIGIA (modo noite): `npm run hefisto:noite` — roda o runner e, se o
// processo cair de forma anormal (crash, OOM), registra e reinicia, até 3
// vezes, com espera crescente. Saída normal (sem missão, STOP, limites) encerra.
// Tudo vai para .hefisto-agent/logs/vigia.log.
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
const estado = join(process.cwd(), cfg.caminhos.estado);
const log = (s) => { L.registrarLog(join(estado, "logs", "vigia.log"), s); console.log(`[vigia] ${s}`); };
const MAX_REINICIOS = 3;

function rodarUmaVez() {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [join(AQUI, "runner.mjs"), ...process.argv.slice(2)], { stdio: "inherit" });
    p.on("close", (codigo, sinal) => ok({ codigo, sinal }));
  });
}

let reinicios = 0;
for (;;) {
  log(`iniciando runner (tentativa ${reinicios + 1})`);
  const { codigo, sinal } = await rodarUmaVez();
  if (codigo === 0) { log("runner terminou normalmente"); break; }
  if (existsSync(join(estado, "STOP"))) { log("STOP presente: não reinicia"); break; }
  if (sinal === "SIGINT" || codigo === 130) { log("interrompido pelo dono: não reinicia"); break; }
  if (++reinicios > MAX_REINICIOS) { log(`runner caiu ${reinicios} vezes (último código ${codigo}): desisto e deixo registrado`); L.gravarStatus(join(estado, "status.json"), { estado: "ENCERRADO", last_result: `vigia desistiu após ${MAX_REINICIOS} reinícios (código ${codigo})` }); process.exit(2); }
  const espera = 30 * reinicios;
  log(`runner caiu (código ${codigo}${sinal ? `, sinal ${sinal}` : ""}); reinicia em ${espera}s`);
  await new Promise((r) => setTimeout(r, espera * 1000));
}
