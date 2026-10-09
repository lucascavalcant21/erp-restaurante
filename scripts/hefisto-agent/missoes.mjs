#!/usr/bin/env node
// MISSÕES: `npm run hefisto:missoes` — valida todas as missões, regenera o
// índice (MISSÕES_ATIVAS.md e BACKLOG.md, só o trecho gerado) e lista a fila.
//   -- nova "Título" [--prioridade 2] [--depende HDEV-001]   cria uma missão em BACKLOG
//   -- pronta HDEV-00X                                        BACKLOG/BLOCKED → READY (zera contadores)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

export function regenerarIndices(raiz, cfg, agora = new Date()) {
  const dir = join(raiz, cfg.caminhos.missoes);
  const missoes = L.carregarMissoes(dir);
  const erros = missoes.flatMap((m) => L.validarMissao(m).map((e) => `${m.id || m.arquivo}: ${e}`));
  const ids = missoes.map((m) => m.id);
  for (const m of missoes) for (const d of m.dependencias || []) if (!ids.includes(d)) erros.push(`${m.id}: depende de ${d}, que não existe`);
  if (erros.length) return { ok: false, erros, missoes };
  const ativas = join(raiz, cfg.caminhos.ativas);
  const backlog = join(raiz, cfg.caminhos.backlog);
  if (existsSync(ativas)) writeFileSync(ativas, L.atualizarTrechoGerado(readFileSync(ativas, "utf8"), L.indiceAtivas(missoes, agora)));
  if (existsSync(backlog)) writeFileSync(backlog, L.atualizarTrechoGerado(readFileSync(backlog, "utf8"), L.indiceBacklog(missoes)));
  return { ok: true, erros: [], missoes };
}

export function novaMissao(raiz, cfg, titulo, { prioridade = 3, dependencias = [], prefixo = "HDEV" } = {}) {
  const dir = join(raiz, cfg.caminhos.missoes);
  const nums = readdirSync(dir).map((f) => new RegExp(`^${prefixo}-(\\d+)`).exec(f)?.[1]).filter(Boolean).map(Number);
  const id = `${prefixo}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  const arquivo = join(dir, `${id}.md`);
  const corpo = `\n# ${id} — ${titulo}\n\n${L.SECOES_MISSAO.map((s) => `## ${s}\n\n${s === "Objetivo" ? "(descreva o resultado esperado para o dono)" : ""}\n`).join("\n")}`;
  L.gravarMissao({ id, titulo, status: "BACKLOG", prioridade, dependencias, bloqueadores: [], tentativas: 0, sem_progresso: 0, mesma_falha: 0, ultima_falha: "", atualizado_em: new Date().toISOString().slice(0, 10), arquivo, corpo });
  return { id, arquivo };
}

export function marcarPronta(raiz, cfg, id) {
  const m = L.carregarMissoes(join(raiz, cfg.caminhos.missoes)).find((x) => x.id === id);
  if (!m) throw new Error(`missão ${id} não encontrada`);
  m.status = "READY"; m.tentativas = 0; m.sem_progresso = 0; m.mesma_falha = 0; m.ultima_falha = "";
  m.corpo = L.anotarSecao(m.corpo, "Histórico", `${new Date().toISOString().slice(0, 16)} marcada READY manualmente`);
  L.gravarMissao(m);
  return m;
}

if (process.argv[1] && process.argv[1].endsWith("missoes.mjs")) {
  const raiz = process.cwd();
  const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
  const [cmd, ...resto] = process.argv.slice(2);
  try {
    if (cmd === "nova") {
      const titulo = resto.filter((x, i) => !x.startsWith("--") && !resto[i - 1]?.startsWith("--")).join(" ");
      const pi = resto.indexOf("--prioridade");
      const di = resto.indexOf("--depende");
      const r = novaMissao(raiz, cfg, titulo, { prioridade: pi >= 0 ? Number(resto[pi + 1]) : 3, dependencias: di >= 0 ? resto[di + 1].split(",") : [] });
      console.log(`criada ${r.id}: ${r.arquivo}`);
    } else if (cmd === "pronta") {
      const m = marcarPronta(raiz, cfg, resto[0]);
      console.log(`${m.id} → READY`);
    } else if (cmd) throw new Error(`comando desconhecido: ${cmd}`);
    const r = regenerarIndices(raiz, cfg);
    if (!r.ok) { console.error(`missões inválidas:\n- ${r.erros.join("\n- ")}`); process.exit(1); }
    const prox = L.proximaMissao(r.missoes);
    for (const st of L.STATUS) {
      const lista = r.missoes.filter((m) => m.status === st);
      if (lista.length) console.log(`${st}: ${lista.map((m) => `${m.id} (P${m.prioridade})`).join(", ")}`);
    }
    console.log(`próxima automática: ${prox ? `${prox.id} — ${prox.titulo}` : "nenhuma"}`);
  } catch (e) {
    console.error(`hefisto:missoes: ${e.message}`);
    process.exit(1);
  }
}
