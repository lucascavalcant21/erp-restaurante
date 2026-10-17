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

const ORDEM = Object.fromEntries(CAMPOS.map(([k], i) => [k, i]));
const RE_CAMPO = /^- \*\*([^*]+):\*\* ?(.*)$/;
const RE_CONTADOR = /^(\*\*Pendentes agora: )\d+(\*\*)/m;

const limpar = (v) => String(v ?? "").replace(/\r?\n+/g, " ").trim();
const valorLido = (bruto) => bruto.trim().replace(/^`(.*)`$/, "$1");
const linhaCampo = (k, v) => `- **${ROTULO[k]}:** ${k === "comando" ? `\`${limpar(v).replaceAll("`", "'")}\`` : limpar(v)}`;

// O arquivo é do dono (editado à mão no Obsidian) e é o histórico: quem grava nunca o
// reescreve a partir do que leu. Pedido novo entra no fim; atualizar e decidir trocam só
// as linhas dos campos que mudam. Sub-listas, notas e linhas que o leitor não conhece
// ficam byte a byte.

/**
 * Seções "### APR-…" com as linhas que ocupam e os campos. Um campo vai da linha
 * "- **Rótulo:** …" até a última linha recuada logo abaixo (sub-lista ou continuação).
 */
function mapear(linhas) {
  const secoes = [];
  let atual = null;
  linhas.forEach((l, i) => {
    if (!/^#{1,3} /.test(l)) return;
    if (atual) atual.fim = i;
    const id = /^### (APR-\d+)/.exec(l)?.[1];
    atual = id ? { id, inicio: i, fim: linhas.length, campos: [] } : null;
    if (atual) secoes.push(atual);
  });
  for (const s of secoes) {
    for (let i = s.inicio + 1; i < s.fim; i++) {
      const m = RE_CAMPO.exec(linhas[i]);
      if (!m) continue;
      let fim = i + 1;
      for (let j = fim; j < s.fim && (/^[ \t]/.test(linhas[j]) || !linhas[j].trim()); j++) if (linhas[j].trim()) fim = j + 1;
      s.campos.push({ k: CAMPO_DO_ROTULO[m[1].trim().toLowerCase()], valor: valorLido(m[2]), inicio: i, fim });
      i = fim - 1;
    }
  }
  return secoes;
}

const comoObjeto = (s) => ({ id: s.id, ...Object.fromEntries(s.campos.filter((c) => c.k).map((c) => [c.k, c.valor])) });
const lerTexto = (texto) => mapear(texto.split(/\r?\n/)).map(comoObjeto);
const fimDeLinha = (texto) => (texto.includes("\r\n") ? "\r\n" : "\n");

/** Lê o arquivo. [{ id, status, missao, … }] na ordem do arquivo (de cada campo, a primeira linha). */
export function lerAprovacoes(arq) {
  return existsSync(arq) ? lerTexto(readFileSync(arq, "utf8")) : [];
}

function secao(a) {
  const linhas = [`### ${a.id} · ${a.status}`, ""];
  for (const [k] of CAMPOS) if (a[k] != null && a[k] !== "") linhas.push(linhaCampo(k, a[k]));
  return linhas.join("\n");
}

/** Troca na seção `id` os campos de `mudancas` (e o status do título). O resto do texto não muda. */
function editarSecao(texto, id, mudancas) {
  const linhas = texto.split(/\r?\n/);
  for (const [k, v] of Object.entries(mudancas)) {
    const s = mapear(linhas).find((x) => x.id === id);
    const nova = linhaCampo(k, v);
    const atual = s.campos.findLast((c) => c.k === k);
    if (atual) {
      if (k === "status") linhas[s.inicio] = linhas[s.inicio].replace(` · ${atual.valor}`, ` · ${limpar(v)}`);
      // mesmo valor: o campo fica como está, com as sub-listas que o dono pôs embaixo
      if (valorLido(RE_CAMPO.exec(nova)[2]) !== atual.valor) linhas.splice(atual.inicio, atual.fim - atual.inicio, nova);
      continue;
    }
    // campo que a seção ainda não tem: na ordem do dono, depois do anterior que existir
    const antes = s.campos.filter((c) => c.k && ORDEM[c.k] < ORDEM[k]).at(-1);
    const depois = s.campos.find((c) => c.k && ORDEM[c.k] > ORDEM[k]);
    let pos = antes?.fim ?? depois?.inicio;
    if (pos == null) for (pos = s.fim; pos > s.inicio + 1 && !linhas[pos - 1].trim(); pos--);
    linhas.splice(pos, 0, ...(pos === s.inicio + 1 ? ["", nova] : [nova]));
  }
  return linhas.join(fimDeLinha(texto));
}

/** Grava o texto com o contador "Pendentes agora" recalculado (só o número; o que vem depois fica). */
function gravarTexto(arq, texto) {
  const pend = lerTexto(texto).filter((a) => a.status === "PENDENTE").length;
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, texto.replace(RE_CONTADOR, `$1${pend}$2`));
}

const lerTextoDoArquivo = (arq) => (existsSync(arq) ? readFileSync(arq, "utf8") : "");

export const contarPendentes = (arq) => lerAprovacoes(arq).filter((a) => a.status === "PENDENTE").length;

/**
 * Registra um pedido. Se já existe um PENDENTE com a mesma `chave` (mesma ação no
 * mesmo alvo), atualiza esse em vez de duplicar. Devolve { aprovacao, nova }.
 */
export function pedirAprovacao(arq, dados, agora = new Date()) {
  for (const k of ["missao", "acao", "ambiente", "risco", "motivo"]) if (!limpar(dados[k])) throw new Error(`pedido de aprovação sem "${ROTULO[k]}"`);
  const texto = lerTextoDoArquivo(arq);
  const lista = lerTexto(texto);
  const chave = limpar(dados.chave) || `${limpar(dados.missao)}:${limpar(dados.acao)}:${limpar(dados.ambiente)}`.toLowerCase();
  const igual = lista.find((a) => a.status === "PENDENTE" && a.chave === chave);
  if (igual) {
    const mudancas = { ...Object.fromEntries(Object.entries(dados).filter(([k, v]) => ROTULO[k] && v != null && v !== "" && k !== "status")), chave };
    gravarTexto(arq, editarSecao(texto, igual.id, mudancas));
    return { aprovacao: Object.assign(igual, Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [k, limpar(v)]))), nova: false };
  }
  const n = lista.reduce((m, a) => Math.max(m, Number(a.id.slice(4))), 0) + 1;
  const nova = {
    impacto: "–", rollback: "desconhecido", evidencias: "–", comando: "–",
    ...Object.fromEntries(Object.entries(dados).filter(([k]) => ROTULO[k])),
    id: `APR-${String(n).padStart(3, "0")}`, status: "PENDENTE", criado_em: agora.toISOString().slice(0, 16).replace("T", " "), chave,
  };
  // só acrescenta no fim: as seções que já existem não passam pelo leitor
  const eol = fimDeLinha(texto);
  const base = texto || `${CABECALHO}\n**Pendentes agora: 0**\n`;
  const sep = base.endsWith(eol + eol) ? "" : base.endsWith(eol) ? eol : eol + eol;
  gravarTexto(arq, `${base}${sep}${secao(nova).replaceAll("\n", eol)}${eol}`);
  return { aprovacao: nova, nova: true };
}

/** Muda o status respeitando as transições. Aprovar/rejeitar exige que não seja o agente. */
export function decidirAprovacao(arq, id, novo, { por = "dono", nota = "", agora = new Date(), env = process.env } = {}) {
  novo = String(novo).toUpperCase();
  if (!STATUS_APROVACAO.includes(novo)) throw new Error(`status inválido: ${novo}`);
  if ((novo === "APROVADO" || novo === "REJEITADO") && env.HEFISTO_AGENT === "1") throw new Error("o agente pede aprovação; só o dono aprova ou rejeita");
  const texto = lerTextoDoArquivo(arq);
  const a = lerTexto(texto).find((x) => x.id === String(id).toUpperCase());
  if (!a) throw new Error(`aprovação ${id} não encontrada`);
  if (!(TRANSICOES[a.status] || []).includes(novo)) throw new Error(`${a.id} está ${a.status}; não pode ir para ${novo}`);
  const mudancas = { status: novo, decidido_em: agora.toISOString().slice(0, 16).replace("T", " "), decidido_por: limpar(por) };
  if (nota) mudancas.nota = limpar(nota);
  gravarTexto(arq, editarSecao(texto, a.id, mudancas));
  return Object.assign(a, mudancas);
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
