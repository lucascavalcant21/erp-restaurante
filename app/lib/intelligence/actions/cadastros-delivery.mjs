// Cadastros do delivery conversando com o Jhon (dono, 17/11/2026):
//   "Jhon, vamos cadastrar 3 plataformas, eu digo o nome e as taxas"  → channel.register
//   "quero cadastrar os custos fixos: luz, água, internet… e outros"   → fixedcost.register
//   "cadastrar funcionários"                                            → employee.register
//
// Uma pergunta por vez, com botões; o que não foi dito é perguntado, nunca
// inventado. Nada é gravado antes do Confirmar. Grava com o cliente do PRÓPRIO
// usuário (RLS), nos mesmos lugares das telas: apps e custos fixos em
// marmitaria_configuracoes (canais, rateio.custos_fixos — Delivery › Custos e
// apps) e funcionário em colaboradores + marmitaria_rh_alocacoes (Delivery ›
// Equipe, como criarFuncionario).

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { lerPreco } from "./criar-ficha.mjs";
import { lerTaxas } from "./criar-marmita.mjs";
import { normalizarCanal } from "../../marmitaria/nucleo.mjs";
import { plataformaDoTexto } from "../../marmitaria/concorrentes.mjs";

const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const limpar = (t) => String(t || "").replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "").trim();
const cap = (t) => { const x = limpar(t); return x ? x[0].toUpperCase() + x.slice(1) : x; };
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, c = 2) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c });
const MAX = 10;
const NUMEROS = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
const numero = (t) => { const f = fold(t); const m = f.match(/\d+/); const n = m ? Number(m[0]) : NUMEROS[f.split(/\s+/)[0]]; return n >= 1 && n <= MAX ? n : null; };
const PRONTO = /^(pronto|so isso|e so|acabou|terminei|pode salvar|salvar|fim|nada mais|mais nada|nenhum|nao)\b/;

const pergunta = (tipo, texto, { opcoes = null, aviso = null } = {}) => ({
  faltando: {
    campo: "resposta", texto: aviso ? `${aviso} ${texto}` : texto,
    opcoes: opcoes ? opcoes.map(({ livre, ...o }) => o) : null, livre: !opcoes || opcoes.some((o) => o.livre),
    persistir: { pendente: { tipo }, aviso: null },
  },
});
const opcoesDeNumero = (n = 5) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), rotulo: String(i + 1) }));
const pendenteSchema = s.opcional(s.object({ tipo: s.string({ max: 20 }) }));
const comum = { pendente: pendenteSchema, aviso: s.opcional(s.string({ max: 200 })), resposta: s.opcional(s.string({ min: 1, max: 200 })) };

/** "vamos cadastrar 3 plataformas", "três funcionários" → 3 */
export function quantidadeDoComando(texto, palavras) {
  const f = fold(texto);
  const m = f.match(new RegExp(`\\b(\\d+|uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)\\s+(?:${palavras})\\b`));
  return m ? numero(m[1]) : null;
}

async function lerConfig(dbe) {
  const linhas = await ler(dbe.from("marmitaria_configuracoes").select("canais, rateio").limit(1), "marmitaria_configuracoes");
  const c = linhas?.[0] || {};
  return { canais: (Array.isArray(c.canais) ? c.canais : []).map(normalizarCanal).filter((x) => x.id), rateio: c.rateio && typeof c.rateio === "object" ? c.rateio : {} };
}

/** Lê a linha da configuração com o cliente do usuário e grava o campo alterado (update ou insert), conferindo a linha. */
async function gravarConfig(db, unidade, alterar) {
  const { data: atual, error: e0 } = await db.from("marmitaria_configuracoes").select("unidade_id, canais, rateio").eq("unidade_id", unidade).maybeSingle();
  if (e0) return { erro: `Não consegui ler as configurações do delivery: ${e0.message}.` };
  const patch = alterar({ canais: Array.isArray(atual?.canais) ? atual.canais : [], rateio: atual?.rateio && typeof atual.rateio === "object" ? atual.rateio : {} });
  const agora = new Date().toISOString();
  const r = atual
    ? await db.from("marmitaria_configuracoes").update({ ...patch, updated_at: agora }).eq("unidade_id", unidade).select("unidade_id")
    : await db.from("marmitaria_configuracoes").insert([{ unidade_id: unidade, ...patch, updated_at: agora }]).select("unidade_id");
  if (r.error) return { erro: /row-level security|permission denied/i.test(r.error.message || "") ? "Sem permissão para alterar as configurações do delivery." : `Não consegui gravar: ${r.error.message}.` };
  if (!r.data?.length) return { erro: "O banco não confirmou a gravação (sem permissão nesta unidade?). Nada foi alterado." };
  return { erro: null };
}

// ═══ Plataformas (apps de entrega) ═══════════════════════════════════════════

const appSchema = s.object({ nome: s.opcional(s.string({ min: 1, max: 40 })), comissao: s.opcional(s.number({ min: 0, max: 99 })), pagamento: s.opcional(s.number({ min: 0, max: 99 })) });

export const paramsPlataformas = s.object({ quantas: s.opcional(s.number({ min: 1, max: MAX, inteiro: true })), apps: s.opcional(s.array(appSchema, { max: MAX })), ...comum });

export const paramsDoComandoPlataformas = (texto) => (
  // "é balcão: cadastrar o balcão como plataforma sem taxa" → venda direta, 0%
  /\bbalcao\b/.test(fold(texto)) ? { quantas: 1, apps: [{ nome: "Balcão", comissao: 0, pagamento: 0 }] } : { quantas: quantidadeDoComando(texto, "plataformas?|apps?|aplicativos?") }
);

function respostaPlataformas(params, _c, valor) {
  const p = JSON.parse(JSON.stringify({ ...params, aviso: null, resposta: null }));
  p.apps = p.apps || [];
  const v = limpar(valor);
  const atual = p.apps[p.apps.length - 1];
  switch (params.pendente?.tipo) {
    case "quantas": { const n = numero(v); if (n) p.quantas = n; else p.aviso = `Diga um número de 1 a ${MAX}.`; break; }
    case "nome": if (v.length >= 2 && v.length <= 40) p.apps.push({ nome: cap(v) }); else p.aviso = "Qual o nome do app?"; break;
    case "taxas": { const t = lerTaxas(v); if (t && atual) { atual.comissao = t.comissao; atual.pagamento = t.pagamento; } else p.aviso = "Quantos por cento? Ex.: \"12% de comissão e 3,2% de pagamento\" (ou \"0\")."; break; }
    default: break;
  }
  return p;
}

async function prepararPlataformas(ctx, params) {
  const p = params || {};
  const apps = p.apps || [];
  const aviso = p.aviso || null;
  if (!p.quantas) return pergunta("quantas", "Vamos lá. Quantas plataformas vamos cadastrar?", { aviso, opcoes: opcoesDeNumero(5) });
  const atual = apps[apps.length - 1];
  if (atual && atual.comissao == null) {
    return pergunta("taxas", `Quantos por cento o ${atual.nome} cobra? Ex.: "12% de comissão e 3,2% de pagamento" (ou "0" se é venda direta).`, { aviso });
  }
  if (apps.length < p.quantas) {
    const k = apps.length + 1;
    const de = p.quantas > 1 ? `Plataforma ${k} de ${p.quantas}: ` : "";
    const sugestoes = ["iFood", "99Food", "Keeta", "Rappi", "WhatsApp"].filter((n) => !apps.some((a) => fold(a.nome) === fold(n)));
    return pergunta("nome", `${de}qual o nome?`, { aviso, opcoes: [...sugestoes.map((n) => ({ id: n, rotulo: n })), { id: "outro", rotulo: "Outro (digite)", livre: true }] });
  }
  const cfg = await lerConfig(ctx.dbe);
  const linhas = apps.map((a) => {
    const ja = cfg.canais.find((c) => fold(c.nome) === fold(a.nome));
    return { rotulo: a.nome, valor: `${num(a.comissao)}% de comissão + ${num(a.pagamento ?? 0)}% de pagamento${ja ? " (já existe: atualiza as taxas)" : ""}` };
  });
  return {
    pronto: {
      preview: { titulo: apps.length > 1 ? `Cadastrar ${apps.length} plataformas` : `Cadastrar ${apps[0].nome}`, entidade: null, linhas },
      payload: { unidade_id: ctx.escopo.unidadeId, apps },
    },
  };
}

/** Junta os apps novos aos que já existem: mesmo nome atualiza as taxas; id novo sem repetir. */
export function juntarCanais(existentes, apps) {
  const canais = existentes.map((c) => ({ ...c }));
  const novos = []; const atualizados = [];
  for (const a of apps) {
    const i = canais.findIndex((c) => fold(c.nome) === fold(a.nome));
    if (i >= 0) { canais[i] = { ...canais[i], comissao_pct: a.comissao, taxa_pagamento_pct: a.pagamento ?? 0, ativo: true }; atualizados.push(a.nome); continue; }
    let base = fold(a.nome).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "app";
    if (base.length < 2) base = `app_${base}`;
    let id = base; let k = 2;
    while (canais.some((c) => c.id === id)) id = `${base}_${k++}`;
    canais.push(normalizarCanal({ id, nome: a.nome, ativo: true, comissao_pct: a.comissao, taxa_pagamento_pct: a.pagamento ?? 0, plataforma: plataformaDoTexto(a.nome) || null }));
    novos.push(a.nome);
  }
  return { canais, novos, atualizados };
}

async function executarPlataformas(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  let res = null;
  const g = await gravarConfig(ctx.dbUsuario, ctx.escopo.unidadeId, ({ canais }) => { res = juntarCanais(canais, payload.apps); return { canais: res.canais }; });
  if (g.erro) return { ok: false, erro: g.erro };
  return { ok: true, resultado: { novos: res.novos, atualizados: res.atualizados }, antes: null, depois: null };
}

function resumoPlataformas(rec) {
  const r = rec.resultado || {};
  const partes = [r.novos?.length ? `cadastrei ${r.novos.join(", ")}` : null, r.atualizados?.length ? `atualizei as taxas de ${r.atualizados.join(", ")}` : null].filter(Boolean);
  return {
    texto: `Pronto: ${partes.join(" e ")}. Já aparecem na montagem das marmitas e no simulador.`,
    linhas: [...(r.novos || []).map((n) => ({ rotulo: "Novo", valor: n })), ...(r.atualizados || []).map((n) => ({ rotulo: "Atualizado", valor: n }))],
    acoes: [{ rotulo: "Abrir custos e apps", rota: "/dashboard/marmitaria/configuracoes" }],
    sugestoes: ["Vamos cadastrar os custos fixos", "Vamos montar umas marmitas"],
    referencia: null,
  };
}

export const cadastrarPlataformas = Object.freeze({
  id: "channel.register", nome: "Cadastrar plataformas", modulo: "marmitaria",
  descricao: "Cadastra apps de entrega (nome e taxas) nas configurações do delivery.",
  capacidade: "configurar_delivery", risco: "LOW", disponivel: true, precisaConfirmacao: true,
  campos: ["quantas", "apps", "pendente", "aviso", "resposta"],
  validacoes: ["nome e taxas ditos pelo dono (nada inventado)", "app com o mesmo nome tem as taxas atualizadas, não duplica", "grava com o usuário logado (RLS)"],
  rollback: "Desligar ou editar o app em Delivery › Custos e apps.",
  paramsSchema: paramsPlataformas, aplicarResposta: respostaPlataformas, preparar: prepararPlataformas, executar: executarPlataformas, resumoResultado: resumoPlataformas,
});

// ═══ Custos fixos ════════════════════════════════════════════════════════════

export const CUSTOS_PADRAO = ["Aluguel", "Luz", "Água", "Gás", "Internet", "Contador", "Sistemas"];
const custoSchema = s.object({ nome: s.string({ min: 1, max: 60 }), valor: s.opcional(s.number({ min: 0.01, max: 1000000 })) });
export const paramsCustos = s.object({ custos: s.opcional(s.array(custoSchema, { max: 20 })), fim: s.opcional(s.boolean()), ...comum });

/** "2.500", "1.200,50", "99,90", "300" → número; senão null. */
export function valorBR(t) {
  const x = String(t ?? "").replace(/r\$|\s/gi, "");
  if (!/^\d/.test(x)) return null;
  const n = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(x) ? Number(x.replace(/\./g, "").replace(",", "."))
    : /,\d{1,2}$/.test(x) ? Number(x.replace(/\./g, "").replace(",", ".")) : Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** "faltou o gás, 150 por mês e internet 99,90" → [{ nome: "Gás", valor: 150 }, { nome: "Internet", valor: 99.9 }] */
export function custosDoTexto(texto) {
  const corpo = String(texto || "").replace(/^.*?\b(?:custos? fixos?|contas? fixas?)\b\s*:?/i, "").replace(/\b(?:jhon|john|faltou|falta|faltando|cadastrar|cadastra|colocar|coloca|adicionar|adiciona|incluir|inclui|quero|vamos)\b/gi, " ");
  const out = [];
  for (const parte of corpo.split(/;|,(?!\d)|\s+e\s+(?=[a-zà-ú])/i)) {
    const m = parte.match(/^\s*(?:(?:o|a|os|as|de|do|da|nos|nas|no|na)\s+)*([a-zà-úç][a-zà-úç ]{1,40}?)\s*(?:de|:|-)?\s*(?:r\$)?\s*(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)\b/i);
    if (!m) continue;
    const valor = valorBR(m[2]);
    const nome = cap(m[1].replace(/\b(por mes|mensal|reais|o|a|de|do|da)\s*$/i, ""));
    if (nome.length >= 2 && valor > 0) out.push({ nome: nome.slice(0, 60), valor });
  }
  return out.slice(0, 20);
}

export const paramsDoComandoCustos = (texto) => ({ custos: custosDoTexto(texto) });

function respostaCustos(params, _c, valor) {
  const p = JSON.parse(JSON.stringify({ ...params, aviso: null, resposta: null }));
  p.custos = p.custos || [];
  const v = limpar(valor);
  const f = fold(v);
  switch (params.pendente?.tipo) {
    case "custo_nome": {
      if (f === "pronto" || PRONTO.test(f)) { if (p.custos.length) p.fim = true; else p.aviso = "Ainda não tem nenhum custo."; break; }
      const lidos = custosDoTexto(v);
      if (lidos.length) { p.custos.push(...lidos); break; }
      if (v.length >= 2 && v.length <= 60 && f !== "outro") p.custos.push({ nome: cap(v) });
      else p.aviso = "Qual o nome do custo?";
      break;
    }
    case "custo_valor": {
      const pr = valorBR(v.replace(/\b(reais|por mes|mensal|mes)\b/gi, "")) ?? lerPreco(v);
      const atual = p.custos[p.custos.length - 1];
      if (pr > 0 && atual) atual.valor = pr; else p.aviso = "Quanto é por mês? Ex.: 300 ou R$ 1.200,00.";
      break;
    }
    default: break;
  }
  p.custos = p.custos.slice(0, 20);
  return p;
}

async function prepararCustos(ctx, params) {
  const p = params || {};
  const custos = p.custos || [];
  const aviso = p.aviso || null;
  const sem = custos.find((c) => !(c.valor > 0));
  if (sem) return pergunta("custo_valor", `Quanto é ${sem.nome === "Luz" || sem.nome === "Água" ? "a conta de " : ""}${sem.nome} por mês?`, { aviso });
  if (!p.fim) {
    const ja = new Set(custos.map((c) => fold(c.nome)));
    const restantes = CUSTOS_PADRAO.filter((n) => !ja.has(fold(n)));
    const texto = custos.length
      ? `Anotado: ${custos.map((c) => `${c.nome} ${brl(c.valor)}`).join(", ")}. Mais algum custo fixo?`
      : "Vamos cadastrar os custos fixos do mês. Qual é o primeiro? Toque numa opção ou digite o nome (pode mandar vários: \"luz 300, água 120\").";
    return pergunta("custo_nome", texto, { aviso, opcoes: [...(custos.length ? [{ id: "pronto", rotulo: "Pronto, pode salvar" }] : []), ...restantes.map((n) => ({ id: n, rotulo: n })), { id: "outro", rotulo: "Outro (digite o nome)", livre: true }] });
  }
  const cfg = await lerConfig(ctx.dbe);
  const existentes = Array.isArray(cfg.rateio.custos_fixos) ? cfg.rateio.custos_fixos : [];
  const linhas = custos.map((c) => {
    const ja = existentes.find((x) => fold(x?.nome) === fold(c.nome));
    return { rotulo: c.nome, valor: ja ? `${brl(Number(ja.valor) || 0)} → ${brl(c.valor)} por mês` : `${brl(c.valor)} por mês` };
  });
  const juntos = juntarCustos(existentes, custos).lista;
  linhas.push({ rotulo: "Total de custos fixos", valor: `${brl(juntos.reduce((t, c) => t + (Number(c.valor) || 0), 0))} por mês` });
  return {
    pronto: {
      preview: { titulo: "Cadastrar custos fixos", entidade: null, linhas },
      payload: { unidade_id: ctx.escopo.unidadeId, custos },
    },
  };
}

/** Mesmo nome troca o valor; nome novo entra no fim. */
export function juntarCustos(existentes, custos) {
  const lista = (Array.isArray(existentes) ? existentes : []).filter((c) => c && String(c.nome || "").trim()).map((c) => ({ ...c }));
  const novos = []; const atualizados = [];
  for (const c of custos) {
    const i = lista.findIndex((x) => fold(x.nome) === fold(c.nome));
    if (i >= 0) { lista[i] = { ...lista[i], valor: c.valor }; atualizados.push(c.nome); } else { lista.push({ nome: c.nome, valor: c.valor }); novos.push(c.nome); }
  }
  return { lista, novos, atualizados };
}

async function executarCustos(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  let res = null;
  const g = await gravarConfig(ctx.dbUsuario, ctx.escopo.unidadeId, ({ rateio }) => {
    res = juntarCustos(rateio.custos_fixos, payload.custos);
    return { rateio: { ...rateio, custos_fixos: res.lista } };
  });
  if (g.erro) return { ok: false, erro: g.erro };
  return { ok: true, resultado: { novos: res.novos, atualizados: res.atualizados, total: res.lista.reduce((t, c) => t + (Number(c.valor) || 0), 0) }, antes: null, depois: null };
}

function resumoCustos(rec) {
  const r = rec.resultado || {};
  return {
    texto: `Custos fixos salvos: total de ${brl(r.total)} por mês. Eles já entram no preço das marmitas e no resultado. Se lembrar de outro, é só dizer "faltou o gás, 150".`,
    linhas: [...(r.novos || []).map((n) => ({ rotulo: "Novo", valor: n })), ...(r.atualizados || []).map((n) => ({ rotulo: "Valor trocado", valor: n }))],
    acoes: [{ rotulo: "Abrir custos e apps", rota: "/dashboard/marmitaria/configuracoes" }],
    sugestoes: ["Faltou um custo fixo", "Vamos cadastrar funcionários"],
    referencia: null,
  };
}

export const cadastrarCustosFixos = Object.freeze({
  id: "fixedcost.register", nome: "Cadastrar custos fixos", modulo: "marmitaria",
  descricao: "Cadastra os custos fixos do mês do delivery (aluguel, luz, água, internet e outros com nome).",
  capacidade: "configurar_delivery", risco: "LOW", disponivel: true, precisaConfirmacao: true,
  campos: ["custos", "fim", "pendente", "aviso", "resposta"],
  validacoes: ["nome e valor ditos pelo dono (nada inventado)", "mesmo nome troca o valor, não duplica", "grava com o usuário logado (RLS)"],
  rollback: "Editar ou apagar o custo em Delivery › Custos e apps.",
  paramsSchema: paramsCustos, aplicarResposta: respostaCustos, preparar: prepararCustos, executar: executarCustos, resumoResultado: resumoCustos,
});

// ═══ Funcionários ════════════════════════════════════════════════════════════

export const FUNCOES = ["Cozinheiro(a)", "Auxiliar de cozinha", "Entregador(a)", "Atendente", "Gerente"];
const pessoaSchema = s.object({ nome: s.opcional(s.string({ min: 2, max: 80 })), cargo: s.opcional(s.string({ min: 2, max: 60 })), salario: s.opcional(s.number({ min: 0, max: 1000000 })) });
export const paramsFuncionarios = s.object({ quantas: s.opcional(s.number({ min: 1, max: MAX, inteiro: true })), pessoas: s.opcional(s.array(pessoaSchema, { max: MAX })), ...comum });

export const paramsDoComandoFuncionarios = (texto) => {
  const q = quantidadeDoComando(texto, "funcionari[oa]s?|colaborador(?:es|as?)?|pessoas?");
  return { quantas: q || (/\b(um|uma|o|a)\s+(funcionari[oa]|colaborador[a]?)\b/.test(fold(texto)) ? 1 : null) };
};

function respostaFuncionarios(params, _c, valor) {
  const p = JSON.parse(JSON.stringify({ ...params, aviso: null, resposta: null }));
  p.pessoas = p.pessoas || [];
  const v = limpar(valor);
  const atual = p.pessoas[p.pessoas.length - 1];
  switch (params.pendente?.tipo) {
    case "quantas": { const n = numero(v); if (n) p.quantas = n; else p.aviso = `Diga um número de 1 a ${MAX}.`; break; }
    case "nome": if (v.length >= 2 && v.length <= 80) p.pessoas.push({ nome: v.split(" ").map(cap).join(" ") }); else p.aviso = "Qual o nome?"; break;
    case "cargo": if (atual && v.length >= 2 && fold(v) !== "outra") atual.cargo = cap(v).slice(0, 60); else p.aviso = "Qual a função?"; break;
    case "salario": {
      const zero = /^(0|zero|nenhum|extra|diarista|freela)\b/.test(fold(v));
      const pr = zero ? 0 : (valorBR(v.replace(/\b(reais|por mes|mensal|mes)\b/gi, "")) ?? lerPreco(v));
      if (atual && pr != null && (pr > 0 || zero)) atual.salario = pr; else p.aviso = "Quanto é o salário por mês? (0 se é extra ou diarista)";
      break;
    }
    default: break;
  }
  return p;
}

async function prepararFuncionarios(ctx, params) {
  const p = params || {};
  const pessoas = p.pessoas || [];
  const aviso = p.aviso || null;
  if (!p.quantas) return pergunta("quantas", "Vamos lá. Quantos funcionários vamos cadastrar?", { aviso, opcoes: opcoesDeNumero(5) });
  const atual = pessoas[pessoas.length - 1];
  if (atual && !atual.cargo) return pergunta("cargo", `Qual a função de ${atual.nome}?`, { aviso, opcoes: [...FUNCOES.map((f) => ({ id: f, rotulo: f })), { id: "outra", rotulo: "Outra (digite)", livre: true }] });
  if (atual && atual.salario == null) return pergunta("salario", `Quanto é o salário de ${atual.nome} por mês? (0 se é extra ou diarista)`, { aviso });
  if (pessoas.length < p.quantas) {
    const k = pessoas.length + 1;
    return pergunta("nome", `${p.quantas > 1 ? `Funcionário ${k} de ${p.quantas}: ` : ""}qual o nome completo?`, { aviso });
  }
  const ja = (await ler(ctx.dbe.from("colaboradores").select("nome, status").limit(1000), "colaboradores")) || [];
  const linhas = pessoas.map((x) => {
    const repetido = ja.some((c) => fold(c.nome) === fold(x.nome) && c.status !== "inativo");
    return { rotulo: x.nome, valor: `${x.cargo} · ${x.salario > 0 ? `${brl(x.salario)} por mês` : "extra/diarista"}${repetido ? " (já cadastrado: não duplica)" : ""}` };
  });
  return {
    pronto: {
      preview: { titulo: pessoas.length > 1 ? `Cadastrar ${pessoas.length} funcionários no delivery` : `Cadastrar ${pessoas[0].nome} no delivery`, entidade: null, linhas },
      payload: { unidade_id: ctx.escopo.unidadeId, pessoas },
    },
  };
}

async function executarFuncionarios(ctx, payload) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const db = ctx.dbUsuario;
  const unidade = ctx.escopo.unidadeId;
  const feitos = []; const repetidos = [];
  for (const x of payload.pessoas || []) {
    const { data: ja } = await db.from("colaboradores").select("id, status").eq("unidade_id", unidade).eq("nome", x.nome).limit(1);
    if (ja?.[0] && ja[0].status !== "inativo") { repetidos.push(x.nome); continue; }
    const { data, error } = await db.from("colaboradores").insert([{ unidade_id: unidade, nome: x.nome, cargo: x.cargo, salario: x.salario, status: "ativo" }]).select("id").single();
    if (error || !data?.id) {
      const sem = /row-level security|permission denied/i.test(error?.message || "");
      return { ok: false, erro: `${sem ? "Só quem tem acesso ao RH pode cadastrar funcionário." : `Não consegui cadastrar ${x.nome}: ${error?.message || "sem resposta do banco"}.`}${feitos.length ? ` Já ficou cadastrado: ${feitos.join(", ")}.` : ""}` };
    }
    const { error: e2 } = await db.from("marmitaria_rh_alocacoes").upsert({ unidade_id: unidade, colaborador_id: data.id, tipo_alocacao: "exclusivo", percentual_tempo: 100, ativo: true }, { onConflict: "unidade_id,colaborador_id" });
    feitos.push(e2 ? `${x.nome} (sem a alocação no delivery: ajuste em Equipe)` : x.nome);
  }
  return { ok: true, resultado: { feitos, repetidos }, antes: null, depois: null };
}

function resumoFuncionarios(rec) {
  const r = rec.resultado || {};
  return {
    texto: `${r.feitos?.length ? `Cadastrei ${r.feitos.join(", ")} na equipe do delivery.` : "Ninguém novo para cadastrar."}${r.repetidos?.length ? ` Já estavam cadastrados: ${r.repetidos.join(", ")}.` : ""} O custo da equipe já entra no preço das marmitas.`,
    linhas: (r.feitos || []).map((n) => ({ rotulo: "Cadastrado", valor: n })),
    acoes: [{ rotulo: "Abrir a equipe", rota: "/dashboard/marmitaria/funcionarios" }],
    sugestoes: ["Vamos cadastrar os custos fixos", "Vamos montar umas marmitas"],
    referencia: null,
  };
}

export const cadastrarFuncionarios = Object.freeze({
  id: "employee.register", nome: "Cadastrar funcionários", modulo: "marmitaria",
  descricao: "Cadastra funcionários na equipe do delivery (nome, função e salário), no cadastro oficial do RH.",
  capacidade: "cadastrar_funcionario", risco: "MEDIUM", disponivel: true, precisaConfirmacao: true,
  campos: ["quantas", "pessoas", "pendente", "aviso", "resposta"],
  validacoes: ["nome, função e salário ditos pelo dono (nada inventado)", "nome já ativo na unidade não duplica", "grava com o usuário logado (RLS do RH)"],
  rollback: "Desligar o funcionário no RH (não apaga o histórico).",
  paramsSchema: paramsFuncionarios, aplicarResposta: respostaFuncionarios, preparar: prepararFuncionarios, executar: executarFuncionarios, resumoResultado: resumoFuncionarios,
});

export const PARAMS_DOS_CADASTROS = Object.freeze({
  "channel.register": paramsDoComandoPlataformas,
  "fixedcost.register": paramsDoComandoCustos,
  "employee.register": paramsDoComandoFuncionarios,
});
