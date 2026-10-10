#!/usr/bin/env node
// SAÚDE DO WHATSAPP: `npm run hefisto:whatsapp:saude`. Consulta a produção com o
// segredo da ponte (do .env.local) e mostra o que está configurado/funcionando.
// Nenhum segredo é impresso: a rota só devolve sim/não, contagens e estados.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function segredo(raiz) {
  const arq = join(raiz, ".env.local");
  const m = existsSync(arq) ? /^HEFISTO_PONTE_SEGREDO=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(arq, "utf8")) : null;
  return process.env.HEFISTO_PONTE_SEGREDO || (m ? m[1].trim() : "");
}

async function main() {
  const base = (process.env.HEFISTO_PONTE_URL || "https://app.hefisto.com.br").replace(/\/+$/, "");
  const s = segredo(process.cwd());
  if (s.length < 32) throw new Error("Falta HEFISTO_PONTE_SEGREDO no .env.local");
  const r = await fetch(`${base}/api/channels/whatsapp/saude`, { headers: { Authorization: `Bearer ${s}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${j.erro || ""}`);
  console.log(JSON.stringify(j, null, 2));
  if (!j.config?.pronto) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
