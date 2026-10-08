#!/usr/bin/env node
// APROVAÇÕES do dono (HDEV-PUBLISH-001): `npm run hefisto:aprovacoes`.
//
// O registro é o próprio docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md (legível no
// Obsidian e versionado no Git). Cada pedido é uma seção "### APR-001 · PENDENTE".
//   PENDENTE → APROVADO | REJEITADO       (só o dono)
//   APROVADO → EXECUTADO                  (quem executou registra)
//
//   -- listar [--todas]
//   -- pedir --missao HDEV-001 --acao "…" --ambiente production --risco HIGH --motivo "…" [--impacto …] [--rollback …] [--evidencias …] [--comando …] [--chave …]
//   -- aprovar APR-001 [nota]   ·   -- rejeitar APR-001 [motivo]   ·   -- executado APR-001 [nota]
//
// O agente PEDE; nunca aprova: com HEFISTO_AGENT=1 (o runner liga no motor) aprovar/rejeitar é recusado.
// Integração futura com WhatsApp: processarComando("APROVAR APR-001", { autorizado }) — quem
// chama precisa ter conferido que a mensagem veio do número do dono (API oficial da Meta).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const STATUS_APROVACAO = Object.freeze(["PENDENTE", "APROVADO", "REJEITADO", "EXECUTADO"]);
const TRANSICOES = { PENDENTE: ["APROVADO", "REJEITADO"], APROVADO: ["EXECUTADO", "REJEITADO"], REJEITADO: [], EXECUTADO: [] };
// ordem e rótulo dos campos (formato pedido pelo dono)
const CAMPOS = [
  ["missao", "Missão"], ["acao", "Ação"], ["ambiente", "Ambiente"], ["risco", "Risco"], ["motivo", "Motivo"],
  ["impacto", "Impacto"], ["rollback", "Rollback"], ["evidencias", "Evidências"], ["comando", "Comando/alteração"],
  ["status", "Status"], ["criado_em", "Criado em"], ["decidido_em", "Decidido em"], ["decidido_por", "Decidido por"],
  ["nota", "Nota"], ["chave", "Chave"],
];
const ROTULO = Object.fromEntries(CAMPOS);
const CAMPO_DO_ROTULO = Object.fromEntries(CAMPOS.map(([k, r]) => [r.toLowerCase(), k]));

const CABECALHO = `# Aprovações pendentes

Pedidos do agente que **só o dono decide** (risco HIGH/CRITICAL, produção, banco real, ações da lista do CLAUDE.md).
O agente para só a etapa pedida e segue no resto. Regras em [[POLITICA_PUBLICACAO]].

- Ver: \`npm run hefisto:aprovacoes\`
- Decidir: \`npm run hefisto:aprovacoes -- aprovar APR-001\` ou \`-- rejeitar APR-001 "motivo"\`
- Depois de executar: \`npm run hefisto:aprovacoes -- executado APR-001\`

Status: PENDENTE → APROVADO / REJEITADO → EXECUTADO. Não apague seções: é o histórico.
`;

const limpar = (v) => String(v ?? "").replace(/\r?\n+/g, " ").trim();

/** Lê o arquivo. [{ id, status, missao, … }] na ordem do arquivo. */
export function lerAprovacoes(arq) {
  if (!existsSync(arq)) return [];
  const texto = readFileSync(arq, "utf8").replace(/\r\n/g, "\n");
  const out = [];
  for (const bloco of texto.split(/^### /m).slice(1)) {
    const id = /^(APR-\d+)/.exec(bloco)?.[1];
    if (!id) continue;
    const a = { id };
    for (const m of bloco.matchAll(/^- \*\*([^*]+):\*\* ?(.*)$/gm)) {
      const k = CAMPO_DO_ROTULO[m[1].trim().toLowerCase()];
      if (k) a[k] = m[2].trim().replace(/^`(.*)`$/, "$1");
    }
    out.push(a);
  }
  return out;
}

function secao(a) {
  const linhas = [`### ${a.id} · ${a.status}`, ""];
  for (const [k, rotulo] of CAMPOS) {
    if (a[k] == null || a[k] === "") continue;
    linhas.push(`- **${rotulo}:** ${k === "comando" ? `\`${limpar(a[k]).replaceAll("`", "'")}\`` : limpar(a[k])}`);
  }
  return linhas.join("\n");
}

export function gravarAprovacoes(arq, lista) {
  mkdirSync(dirname(arq), { recursive: true });
  const pend = lista.filter((a) => a.status === "PENDENTE").length;
  writeFileSync(arq, `${CABECALHO}\n**Pendentes agora: ${pend}**\n\n${lista.map(secao).join("\n\n")}\n`);
}

export const contarPendentes = (arq) => lerAprovacoes(arq).filter((a) => a.status === "PENDENTE").length;

/**
 * Registra um pedido. Se já existe um PENDENTE com a mesma `chave` (mesma ação no
 * mesmo alvo), atualiza esse em vez de duplicar. Devolve { aprovacao, nova }.
 */
export function pedirAprovacao(arq, dados, agora = new Date()) {
  for (const k of ["missao", "acao", "ambiente", "risco", "motivo"]) if (!limpar(dados[k])) throw new Error(`pedido de aprovação sem "${ROTULO[k]}"`);
  const lista = lerAprovacoes(arq);
  const chave = limpar(dados.chave) || `${limpar(dados.missao)}:${limpar(dados.acao)}:${limpar(dados.ambiente)}`.toLowerCase();
  const igual = lista.find((a) => a.status === "PENDENTE" && a.chave === chave);
  if (igual) {
    Object.assign(igual, Object.fromEntries(Object.entries(dados).filter(([k, v]) => ROTULO[k] && v != null && v !== "" && k !== "status")), { chave });
    gravarAprovacoes(arq, lista);
    return { aprovacao: igual, nova: false };
  }
  const n = lista.reduce((m, a) => Math.max(m, Number(a.id.slice(4))), 0) + 1;
  const nova = {
    impacto: "–", rollback: "desconhecido", evidencias: "–", comando: "–",
    ...Object.fromEntries(Object.entries(dados).filter(([k]) => ROTULO[k])),
    id: `APR-${String(n).padStart(3, "0")}`, status: "PENDENTE", criado_em: agora.toISOString().slice(0, 16).replace("T", " "), chave,
  };
  lista.push(nova);
  gravarAprovacoes(arq, lista);
  return { aprovacao: nova, nova: true };
}

/** Muda o status respeitando as transições. Aprovar/rejeitar exige que não seja o agente. */
export function decidirAprovacao(arq, id, novo, { por = "dono", nota = "", agora = new Date(), env = process.env } = {}) {
  novo = String(novo).toUpperCase();
  if (!STATUS_APROVACAO.includes(novo)) throw new Error(`status inválido: ${novo}`);
  if ((novo === "APROVADO" || novo === "REJEITADO") && env.HEFISTO_AGENT === "1") throw new Error("o agente pede aprovação; só o dono aprova ou rejeita");
  const lista = lerAprovacoes(arq);
  const a = lista.find((x) => x.id === String(id).toUpperCase());
  if (!a) throw new Error(`aprovação ${id} não encontrada`);
  if (!(TRANSICOES[a.status] || []).includes(novo)) throw new Error(`${a.id} está ${a.status}; não pode ir para ${novo}`);
  a.status = novo;
  a.decidido_em = agora.toISOString().slice(0, 16).replace("T", " ");
  a.decidido_por = limpar(por);
  if (nota) a.nota = limpar(nota);
  gravarAprovacoes(arq, lista);
  return a;
}

/** "APROVAR APR-001", "rejeitar apr-7 motivo" → { acao, id, resto } ou null. Para o canal do WhatsApp. */
export function interpretarComando(texto) {
  const m = /^\s*(aprovar|aprovo|rejeitar|rejeito|recusar)\s+(apr-?\s*\d+)\b\s*(.*)$/i.exec(String(texto || "").normalize("NFC"));
  if (!m) return null;
  const n = Number(m[2].replace(/\D/g, ""));
  return { acao: /^aprov/i.test(m[1]) ? "APROVADO" : "REJEITADO", id: `APR-${String(n).padStart(3, "0")}`, resto: m[3].trim() };
}

/**
 * Porta de entrada de canais externos (WhatsApp no futuro). `autorizado` é
 * responsabilidade de quem chama: só true se a mensagem veio, comprovadamente,
 * do dono. Devolve a resposta a mandar de volta.
 */
export function processarComando(arq, texto, { autorizado = false, origem = "canal externo", agora = new Date(), env = process.env } = {}) {
  const c = interpretarComando(texto);
  if (!c) return { ok: false, resposta: "Não entendi. Use: APROVAR APR-001 ou REJEITAR APR-001 motivo" };
  if (!autorizado) return { ok: false, resposta: "Só o dono pode aprovar ou rejeitar." };
  try {
    const a = decidirAprovacao(arq, c.id, c.acao, { por: `dono via ${origem}`, nota: c.resto, agora, env });
    return { ok: true, aprovacao: a, resposta: `${a.id} ${a.status}: ${a.acao}` };
  } catch (e) {
    return { ok: false, resposta: e.message };
  }
}

function argsNomeados(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) o[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] == null ? true : argv[++i];
  return o;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
  const arq = join(process.cwd(), cfg.caminhos.aprovacoes);
  const [cmd = "listar", ...resto] = process.argv.slice(2);
  try {
    if (cmd === "listar") {
      const todas = lerAprovacoes(arq);
      const mostrar = resto.includes("--todas") ? todas : todas.filter((a) => a.status === "PENDENTE" || a.status === "APROVADO");
      console.log(`Aprovações: ${todas.filter((a) => a.status === "PENDENTE").length} pendente(s) · ${todas.length} no total (${arq})`);
      for (const a of mostrar) console.log(`  ${a.id} [${a.status}] ${a.risco} · ${a.ambiente} · ${a.missao}: ${a.acao}\n      motivo: ${a.motivo} · rollback: ${a.rollback}`);
    } else if (cmd === "pedir") {
      const r = pedirAprovacao(arq, argsNomeados(resto));
      console.log(`${r.aprovacao.id} ${r.nova ? "criada" : "atualizada"} (PENDENTE): ${r.aprovacao.acao}`);
    } else if (["aprovar", "rejeitar", "executado"].includes(cmd)) {
      const [id, ...nota] = resto;
      const novo = { aprovar: "APROVADO", rejeitar: "REJEITADO", executado: "EXECUTADO" }[cmd];
      const a = decidirAprovacao(arq, id, novo, { por: process.env.USERNAME || process.env.USER || "dono", nota: nota.join(" ") });
      console.log(`${a.id} → ${a.status}: ${a.acao}`);
    } else {
      throw new Error("comandos: listar [--todas] | pedir --missao … --acao … --ambiente … --risco … --motivo … | aprovar ID | rejeitar ID [motivo] | executado ID");
    }
  } catch (e) {
    console.error(`hefisto:aprovacoes: ${e.message}`);
    process.exit(1);
  }
}
