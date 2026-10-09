#!/usr/bin/env node
// PONTE NO LOGIN DO WINDOWS (HDEV-WA-REAL-001): `npm run hefisto:ponte:autostart -- instalar | remover | status`.
// Coloca um .cmd na pasta Inicializar do USUÁRIO (sem admin, sem serviço do sistema):
// no login, abre a ponte do WhatsApp minimizada, na pasta do projeto. O segredo da
// ponte continua só no .env.local; o .cmd não guarda nenhum segredo.
// Remover: `npm run hefisto:ponte:autostart -- remover` (ou apagar o arquivo).
import { writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const NOME_ARQUIVO = "hefisto-ponte-whatsapp.cmd";

export function pastaInicializar(env = process.env) {
  if (!env.APPDATA) throw new Error("APPDATA não definido (só funciona no Windows)");
  return join(env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

export function conteudoCmd(raiz, node = process.execPath) {
  return [
    "@echo off",
    "rem Hefisto: ponte do WhatsApp (HDEV-WA-REAL-001). Remover: npm run hefisto:ponte:autostart -- remover",
    `cd /d "${raiz}"`,
    `start "Hefisto ponte WhatsApp" /min "${node}" "${join(raiz, "scripts", "hefisto-agent", "ponte-whatsapp.mjs")}"`,
    "",
  ].join("\r\n");
}

function main() {
  const raiz = process.cwd();
  const arq = join(pastaInicializar(), NOME_ARQUIVO);
  const cmd = process.argv[2] || "status";
  if (cmd === "instalar") {
    if (!existsSync(join(raiz, "scripts", "hefisto-agent", "ponte-whatsapp.mjs"))) throw new Error("rode na pasta do projeto");
    if (!/^HEFISTO_PONTE_SEGREDO=.{32,}/m.test(existsSync(join(raiz, ".env.local")) ? readFileSync(join(raiz, ".env.local"), "utf8") : "")) {
      throw new Error("falta HEFISTO_PONTE_SEGREDO no .env.local");
    }
    writeFileSync(arq, conteudoCmd(raiz));
    console.log(`Instalado: a ponte abre minimizada no próximo login.\n${arq}`);
  } else if (cmd === "remover") {
    rmSync(arq, { force: true });
    console.log("Removido: a ponte não abre mais sozinha no login.");
  } else if (cmd === "status") {
    console.log(existsSync(arq) ? `Instalado: ${arq}` : "Não instalado.");
  } else {
    throw new Error("use: instalar | remover | status");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
