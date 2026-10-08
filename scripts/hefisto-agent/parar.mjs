#!/usr/bin/env node
// PARAR: `npm run hefisto:parar` — pede para o runner parar ao fim da missão
// atual (cria .hefisto-agent/STOP). `-- --agora` também interrompe o processo:
// a missão em andamento volta para READY (o runner trata o sinal).
// `-- --liberar` apaga o STOP para o próximo `npm run hefisto:agent`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
const estado = join(process.cwd(), cfg.caminhos.estado);
const stop = join(estado, "STOP");

if (process.argv.includes("--liberar")) {
  rmSync(stop, { force: true });
  console.log("STOP removido: o próximo npm run hefisto:agent volta a trabalhar.");
} else {
  mkdirSync(estado, { recursive: true });
  writeFileSync(stop, `pedido em ${new Date().toISOString()}\n`);
  console.log("STOP criado: o runner termina a missão atual e para.");
  if (process.argv.includes("--agora")) {
    const lock = L.lerStatus(join(estado, "runner.lock"));
    if (lock && L.pidVivo(lock.pid)) { process.kill(lock.pid, "SIGTERM"); console.log(`SIGTERM enviado ao runner (pid ${lock.pid}).`); }
    else console.log("Nenhum runner rodando.");
  }
  if (existsSync(stop)) console.log("Para voltar: npm run hefisto:parar -- --liberar");
}
