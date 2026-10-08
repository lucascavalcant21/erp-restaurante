#!/usr/bin/env node
// WATCHDOG / STATUS: `npm run hefisto:status` (ou `-- --json`).
// Diz se o agente está RODANDO, TRAVADO (vivo sem heartbeat), PARADO ou
// NUNCA_INICIADO; qual missão; último checkpoint e resultado; próxima READY;
// bloqueadas. Código de saída: 0 rodando/parado normal, 2 travado ou parado
// sem registrar fim (para um cron/monitor reagir).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";
import { PUBLICACAO_PADRAO } from "./politica.mjs";
import { contarPendentes } from "./aprovacoes.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

export function relatorioStatus(raiz, cfg, agora = new Date()) {
  const estado = join(raiz, cfg.caminhos.estado);
  const s = L.lerStatus(join(estado, "status.json"));
  const d = L.diagnostico(s, { agora, travadoAposMinutos: cfg.limites.travadoAposMinutos });
  const missoes = L.carregarMissoes(join(raiz, cfg.caminhos.missoes));
  const prox = L.proximaMissao(missoes);
  return {
    estado: d.estado,
    detalhe: d.detalhe,
    agent_started_at: s?.agent_started_at || null,
    current_mission: s?.current_mission || null,
    last_checkpoint: s?.last_checkpoint || null,
    last_result: s?.last_result || null,
    last_heartbeat: s?.last_heartbeat || null,
    stop_pedido: existsSync(join(estado, "STOP")),
    proxima: prox ? `${prox.id} — ${prox.titulo}` : null,
    bloqueadas: missoes.filter((m) => m.status === "BLOCKED").map((m) => m.id),
    contagem: Object.fromEntries(L.STATUS.map((st) => [st, missoes.filter((m) => m.status === st).length]).filter(([, n]) => n)),
    publicacao: estadoPublicacao(raiz, cfg, s),
  };
}

/** Modo de publicação, o que a configuração libera e o que espera o dono (HDEV-PUBLISH-001). */
export function estadoPublicacao(raiz, cfg, s) {
  const p = { ...PUBLICACAO_PADRAO, ...(cfg.publicacao || {}) };
  const ultima = s?.politica || null;
  const pendentes = cfg.caminhos.aprovacoes ? contarPendentes(join(raiz, cfg.caminhos.aprovacoes)) : 0;
  return {
    modo: p.autoPublishPreview ? "AUTO SAFE" : "APPROVAL REQUIRED (preview também pede o dono)",
    producao: p.autoPublishProductionLowRisk ? "permitida (LOW/MEDIUM com tudo verde e preview validado)" : "aguardando aprovação (autoPublishProductionLowRisk=false)",
    migracoes: p.autoApplySafeMigrations ? "SAFE liberada pela política (o runner não tem ferramenta para aplicar)" : "aguardando aprovação (autoApplySafeMigrations=false)",
    ultima_migracao: ultima?.migracao ? ultima.migracao.toLowerCase() : null,
    ultimo_preview: ultima?.preview || null,
    ultima_producao: ultima?.producao || null,
    motivos: ultima?.motivos || [],
    aprovacoes_pendentes: pendentes,
  };
}

if (process.argv[1] && process.argv[1].endsWith("status.mjs")) {
  const raiz = process.cwd();
  const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
  const r = relatorioStatus(raiz, cfg);
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`Agente Héfisto: ${r.estado} — ${r.detalhe}`);
    console.log(`  início: ${r.agent_started_at || "–"} · heartbeat: ${r.last_heartbeat || "–"}`);
    console.log(`  missão atual: ${r.current_mission || "nenhuma"} · checkpoint: ${(r.last_checkpoint || "–").slice(0, 10)}`);
    console.log(`  último resultado: ${r.last_result || "–"}`);
    console.log(`  próxima READY: ${r.proxima || "nenhuma"}`);
    console.log(`  bloqueadas: ${r.bloqueadas.join(", ") || "nenhuma"} · missões: ${Object.entries(r.contagem).map(([k, v]) => `${k} ${v}`).join(", ") || "nenhuma"}`);
    if (r.stop_pedido) console.log("  STOP pedido: o runner para ao fim da missão atual (apague .hefisto-agent/STOP para liberar).");
    const p = r.publicacao;
    console.log(`  modo publicação: ${p.modo}`);
    console.log(`  produção: ${p.producao}${p.ultima_producao ? ` · última avaliação: ${p.ultima_producao}` : ""}`);
    console.log(`  migration: ${p.ultima_migracao || "nenhuma na última rodada"} · ${p.migracoes}`);
    console.log(`  preview (último push): ${p.ultimo_preview || "–"}${p.motivos.length ? ` — ${p.motivos.join("; ")}` : ""}`);
    console.log(`  aprovações pendentes: ${p.aprovacoes_pendentes}${p.aprovacoes_pendentes ? " (npm run hefisto:aprovacoes)" : ""}`);
  }
  process.exit(r.estado === "TRAVADO" || (r.estado === "PARADO" && !/encerrado normalmente/.test(r.detalhe)) ? 2 : 0);
}
