#!/usr/bin/env node
// PONTE DO WHATSAPP (HDEV-WA-001): `npm run hefisto:ponte`.
// Busca na produção os comandos de desenvolvimento que chegaram pelo WhatsApp
// do dono (status, continue, pare, missões, bloqueadores, aprovações,
// aprovar/rejeitar), executa AQUI com as mesmas funções dos comandos npm e
// devolve a resposta. Só sai do PC o texto da resposta.
//
// Configuração (no .env.local, que não vai para o git):
//   HEFISTO_PONTE_SEGREDO=<o mesmo valor de WHATSAPP_PONTE_SEGREDO na Vercel>
//   HEFISTO_PONTE_URL=https://app.hefisto.com.br   (opcional)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import * as L from "./lib.mjs";
import { relatorioStatus } from "./status.mjs";
import { lerAprovacoes, processarComando as decidirPorTexto } from "./aprovacoes.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const INTERVALO_MS = 5_000;

// ─── respostas (puras, testadas em __tests__/ponte-whatsapp.test.mjs) ─────────

const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export function textoStatus(r) {
  const linhas = [`*Agente: ${r.estado}*${r.detalhe ? ` (${r.detalhe})` : ""}`];
  if (r.current_mission) linhas.push(`Missão atual: ${r.current_mission}`);
  if (r.last_checkpoint) linhas.push(`Último checkpoint: ${r.last_checkpoint}`);
  if (r.last_result) linhas.push(`Último resultado: ${r.last_result}`);
  if (r.last_heartbeat) linhas.push(`Sinal de vida: ${quando(r.last_heartbeat)}`);
  if (r.stop_pedido) linhas.push("STOP pedido: o agente para ao fim da missão atual.");
  linhas.push(`Próxima: ${r.proxima || "nenhuma missão READY"}`);
  const cont = Object.entries(r.contagem || {}).map(([k, v]) => `${k} ${v}`).join(" · ");
  if (cont) linhas.push(`Missões: ${cont}`);
  if (r.bloqueadas?.length) linhas.push(`Bloqueadas: ${r.bloqueadas.join(", ")}`);
  if (r.publicacao?.aprovacoes_pendentes) linhas.push(`Aprovações pendentes: ${r.publicacao.aprovacoes_pendentes} (mande "aprovações")`);
  return linhas.join("\n");
}

export function textoMissoes(missoes) {
  const ordem = ["IN_PROGRESS", "VALIDATING", "READY", "BLOCKED", "BACKLOG", "FAILED"];
  const linhas = ["*Missões*"];
  for (const st of ordem) {
    const lista = missoes.filter((m) => m.status === st).sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9));
    if (!lista.length) continue;
    linhas.push("", `*${st}* (${lista.length})`, ...lista.slice(0, 8).map((m) => `• ${m.id} — ${m.titulo}`));
    if (lista.length > 8) linhas.push(`• e mais ${lista.length - 8}`);
  }
  const feitas = missoes.filter((m) => m.status === "DONE").length;
  if (feitas) linhas.push("", `DONE: ${feitas}`);
  return linhas.join("\n");
}

/** Linhas da tabela de BLOQUEADORES.md ainda abertas (uma por ID; a última vale). */
export function bloqueadoresAbertos(md) {
  const porId = new Map();
  for (const l of String(md).split(/\r?\n/)) {
    const c = l.split("|").map((x) => x.trim());
    if (!/^BLQ-\d+$/.test(c[1] || "")) continue;
    porId.set(c[1], { id: c[1], bloqueia: c[2], falta: c[3], quem: c[4], estado: c[6] || "" });
  }
  return [...porId.values()].filter((b) => !/^RESOLVIDO/i.test(b.estado));
}

const curto = (t, n = 220) => { const s = String(t || "").replace(/\[\[|\]\]|\*\*/g, ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

export function textoBloqueadores(abertos) {
  if (!abertos.length) return "Nenhum bloqueador aberto.";
  return ["*Bloqueadores abertos*", ...abertos.map((b) => `\n*${b.id}* · ${curto(b.bloqueia, 80)}\nFalta: ${curto(b.falta)}\nQuem: ${curto(b.quem, 80)}`)].join("\n");
}

export function textoAprovacoes(lista) {
  const abertas = lista.filter((a) => a.status === "PENDENTE" || a.status === "APROVADO");
  if (!abertas.length) return "Nenhuma aprovação pendente.";
  return ["*Aprovações*", ...abertas.map((a) => `\n*${a.id}* [${a.status}] ${a.risco || ""} · ${a.ambiente || ""}\n${curto(a.acao, 300)}\nRollback: ${curto(a.rollback, 160)}`),
    "", "Responda: aprovar APR-xxx  ou  rejeitar APR-xxx motivo"].join("\n");
}

// ─── execução local ───────────────────────────────────────────────────────────

export function executar(item, { raiz = process.cwd(), cfg, agora = new Date(), iniciarAgente = iniciarVigia } = {}) {
  const estado = join(raiz, cfg.caminhos.estado);
  const stop = join(estado, "STOP");
  const arqAprov = join(raiz, cfg.caminhos.aprovacoes);
  switch (item.comando) {
    case "status":
    case "desenvolvimento":
      return { ok: true, resposta: textoStatus(relatorioStatus(raiz, cfg, agora)) };
    case "missoes":
      return { ok: true, resposta: textoMissoes(L.carregarMissoes(join(raiz, cfg.caminhos.missoes))) };
    case "bloqueadores": {
      const arq = join(raiz, cfg.caminhos.cerebro, "03_ROADMAP", "BLOQUEADORES.md");
      return { ok: true, resposta: textoBloqueadores(existsSync(arq) ? bloqueadoresAbertos(readFileSync(arq, "utf8")) : []) };
    }
    case "aprovacoes":
      return { ok: true, resposta: textoAprovacoes(lerAprovacoes(arqAprov)) };
    case "aprovar":
    case "rejeitar": {
      const texto = `${item.comando} ${item.args?.id || ""} ${item.args?.nota || ""}`.trim();
      // a mensagem só entra na fila se veio do número autorizado (conferido no webhook assinado)
      const r = decidirPorTexto(arqAprov, texto, { autorizado: true, origem: "WhatsApp", agora });
      return { ok: r.ok, resposta: r.ok ? `${r.resposta}\n\nAprovado não é executado sozinho: a aplicação acontece em sessão acompanhada.` : r.resposta };
    }
    case "parar":
      mkdirSync(estado, { recursive: true });
      writeFileSync(stop, `pedido pelo WhatsApp em ${agora.toISOString()}\n`);
      return { ok: true, resposta: "STOP criado: o agente termina a missão atual e para. Para voltar: continue" };
    case "continuar": {
      rmSync(stop, { force: true });
      const lock = L.lerStatus(join(estado, "runner.lock"));
      if (lock && L.pidVivo(lock.pid)) return { ok: true, resposta: `STOP removido. O agente já está rodando (pid ${lock.pid}).` };
      const pid = iniciarAgente(raiz);
      return { ok: true, resposta: `STOP removido e agente iniciado em modo contínuo${pid ? ` (pid ${pid})` : ""}. Mande "status" para acompanhar.` };
    }
    default:
      return { ok: false, resposta: `Comando desconhecido: ${item.comando}` };
  }
}

function iniciarVigia(raiz) {
  const p = spawn(process.execPath, [join(AQUI, "vigia.mjs"), "--continuo"], { cwd: raiz, detached: true, stdio: "ignore", windowsHide: true });
  p.unref();
  return p.pid;
}

function lerEnvLocal(raiz) {
  const arq = join(raiz, ".env.local");
  if (!existsSync(arq)) return {};
  const o = {};
  for (const l of readFileSync(arq, "utf8").split(/\r?\n/)) {
    const m = /^\s*(HEFISTO_PONTE_[A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/.exec(l);
    if (m) o[m[1]] = m[2].trim();
  }
  return o;
}

async function laco() {
  const raiz = process.cwd();
  const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
  const env = { ...lerEnvLocal(raiz), ...process.env };
  const segredo = env.HEFISTO_PONTE_SEGREDO || "";
  const base = (env.HEFISTO_PONTE_URL || "https://app.hefisto.com.br").replace(/\/+$/, "");
  if (segredo.length < 32) { console.error("Falta HEFISTO_PONTE_SEGREDO (32+ caracteres) no .env.local. Veja docs/brain/06_OPERACAO/WHATSAPP_SETUP.md"); process.exit(1); }
  const url = `${base}/api/channels/whatsapp/ponte`;
  const headers = { Authorization: `Bearer ${segredo}`, "Content-Type": "application/json" };
  const log = (s) => { L.registrarLog(join(raiz, cfg.caminhos.estado, "logs", "ponte-whatsapp.log"), s); console.log(`[ponte] ${s}`); };
  log(`ligada em ${base} (Ctrl+C para sair)`);
  let avisou = false;
  for (;;) {
    try {
      const r = await fetch(url, { headers });
      if (r.status === 401) { console.error("Segredo da ponte recusado (401). Confira HEFISTO_PONTE_SEGREDO."); process.exit(1); }
      const corpo = await r.json().catch(() => ({}));
      if (corpo.indisponivel && !avisou) { log("fila ainda não existe no banco (APR-003 pendente); tentando de novo"); avisou = true; }
      for (const item of corpo.itens || []) {
        let res;
        try { res = executar(item, { raiz, cfg }); } catch (e) { res = { ok: false, resposta: `Falhou aqui no PC: ${e.message}` }; }
        const env2 = await fetch(url, { method: "POST", headers, body: JSON.stringify({ id: item.id, ok: res.ok, resposta: res.resposta }) });
        log(`${item.comando} → ${res.ok ? "ok" : "falhou"} (envio HTTP ${env2.status})`);
      }
    } catch (e) {
      log(`sem conexão (${e.cause?.code || e.name}); tentando de novo`);
    }
    await new Promise((ok) => setTimeout(ok, INTERVALO_MS));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) laco();
