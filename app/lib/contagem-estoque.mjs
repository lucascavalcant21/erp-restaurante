// CONTAGEM DE ESTOQUE (INVENTÁRIO) — F2.4A, sobre as tabelas da F2.1
// (aplicadas em produção em 2026-10-01). Sem migration.
//
//   inventário  → public.estoque_contagens (tipo, data de referência, status)
//                 estoque_id NULO = a unidade inteira; cada item diz o local.
//   item        → public.estoque_contagens_itens (quantidade em unidade base
//                 g/ml/un, saldo do sistema na hora, custo congelado no fechamento)
//   pendências  → produto não cadastrado, guardado no próprio inventário
//                 (observacao em JSON) até ser cadastrado de verdade.
//
// Regras:
// - quem conta só informa QUANTIDADE; custo entra no fechamento;
// - "não contado" = sem linha; "contado zero" = linha com 0 (nunca se confundem);
// - kg↔g e L↔ml são as únicas conversões automáticas; garrafa, lata, caixa,
//   pacote… são contadas como estão no cadastro (nenhuma conversão inventada);
// - inventário fechado é imutável (trigger do banco); correção é por ajuste.
//
// Funções com banco recebem o cliente (`db`) por parâmetro (testáveis).

import { hojeLocal, dataValida, lerValor, unidadeValida, novaChave } from "./contas-pagar.mjs";

export { hojeLocal, novaChave };

const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const r2 = (n) => Math.round(Number(n) * 100) / 100;
function falha(msg) { return { data: null, error: msg }; }
function erroDb(e) { return e ? (e.message || String(e)) : null; }

// ─── Tipos, status e locais ──────────────────────────────────────────────────
export const TIPOS_CONTAGEM = [
  { codigo: "inicial", rotulo: "Estoque inicial" },
  { codigo: "intermediaria", rotulo: "Contagem semanal" },
  { codigo: "final", rotulo: "Fechamento do mês" },
  { codigo: "ajuste", rotulo: "Ajuste" },
];
export const rotuloTipo = (c) => TIPOS_CONTAGEM.find((t) => t.codigo === c)?.rotulo || c || "—";
export const STATUS_CONTAGEM = { aberta: "Em contagem", fechada: "Fechado", cancelada: "Cancelado" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "Estoque inicial — outubro/2026" (o mês é o da data de referência). */
export function tituloContagem(c) {
  const [a, m] = String(c?.data_referencia || "").split("-").map(Number);
  const mes = a && m ? `${MESES[m - 1]}/${a}` : "";
  return `${rotuloTipo(c?.tipo)}${mes ? ` — ${mes}` : ""}`;
}

/** Os 4 grupos da tela. Os estoques reais da unidade são distribuídos neles pelo slug. */
export const GRUPOS_LOCAL = [
  { id: "cozinha", rotulo: "Cozinha" },
  { id: "bar", rotulo: "Bar" },
  { id: "pre", rotulo: "Pré-preparos" },
  { id: "outros", rotulo: "Outros" },
];
export function grupoDoEstoque(estoque) {
  const s = String(estoque?.slug || "").toLowerCase();
  if (s === "cozinha") return "cozinha";
  if (s === "bar") return "bar";
  if (s.startsWith("pre-preparos")) return "pre";
  return "outros";
}

// ─── Unidades ────────────────────────────────────────────────────────────────
const MASSA = { kg: 1000, g: 1 };
const VOLUME = { l: 1000, ml: 1 };
/**
 * Como um produto é contado: rótulo (o do cadastro), unidade base gravada no
 * banco e fator (quanto 1 rótulo vale na base). kg→g e L→ml são conversões
 * exatas; o resto é contado como peça do próprio cadastro (base "un").
 */
export function unidadeContagem(unidadeMedida) {
  const bruto = String(unidadeMedida || "").trim();
  const u = bruto.toLowerCase();
  if (u in MASSA) return { rotulo: u, base: "g", fator: MASSA[u] };
  if (u in VOLUME) return { rotulo: u === "l" ? "L" : "ml", base: "ml", fator: VOLUME[u] };
  return { rotulo: bruto || "un", base: "un", fator: 1 };
}
export const paraBase = (qtd, unidadeMedida) => r3(Number(qtd) * unidadeContagem(unidadeMedida).fator);
export const daBase = (qtdBase, unidadeMedida) => (qtdBase == null ? null : r3(Number(qtdBase) / unidadeContagem(unidadeMedida).fator));
export const fmtQtd = (n) => (n == null ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 }));

/** Quantidade digitada (na unidade do cadastro) → número válido ou erro. */
export function lerQuantidade(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return { erro: "Informe a quantidade." };
  const q = lerValor(s);
  if (!Number.isFinite(q)) return { erro: "Quantidade inválida." };
  if (q < 0) return { erro: "A quantidade não pode ser negativa." };
  if (q >= 1e9) return { erro: "Quantidade grande demais: confira o número." };
  return { valor: r3(q) };
}

// ─── Ciclo do mês: inicial, semanais, fechamento ─────────────────────────────
const p2 = (n) => String(n).padStart(2, "0");
/** Dia 1 = inicial; 8, 15, 22, 29 = semanais (se antes do último dia); último dia = fechamento. */
export function cicloDoMes(ano, mes) {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const d = (dia) => `${ano}-${p2(mes)}-${p2(dia)}`;
  const ciclo = [{ data: d(1), tipo: "inicial" }];
  for (let dia = 8; dia < ultimo; dia += 7) ciclo.push({ data: d(dia), tipo: "intermediaria" });
  ciclo.push({ data: d(ultimo), tipo: "final" });
  return ciclo;
}
/** Próxima data do ciclo ainda sem inventário fechado (a partir de hoje). */
export function proximaContagem(contagens, hoje = hojeLocal()) {
  const [a, m] = hoje.split("-").map(Number);
  const fechadas = new Set((contagens || []).filter((c) => c.status === "fechada").map((c) => String(c.data_referencia).slice(0, 10)));
  const ciclo = [...cicloDoMes(a, m), ...cicloDoMes(m === 12 ? a + 1 : a, m === 12 ? 1 : m + 1)];
  return ciclo.find((x) => x.data >= hoje && !fechadas.has(x.data)) || null;
}

// ─── Observação do inventário: nota + pendências (produto não cadastrado) ───
export function lerObs(texto) {
  try {
    const o = JSON.parse(texto);
    if (o && typeof o === "object" && o.hefisto === "contagem") {
      return { nota: String(o.nota || ""), pendencias: Array.isArray(o.pendencias) ? o.pendencias : [] };
    }
  } catch { /* texto livre antigo */ }
  return { nota: String(texto || ""), pendencias: [] };
}
export function escreverObs({ nota = "", pendencias = [] } = {}) {
  return JSON.stringify({ hefisto: "contagem", v: 1, nota, pendencias });
}
export const UNIDADES_PENDENCIA = ["kg", "g", "L", "ml", "un", "garrafa", "lata", "caixa", "pacote", "fardo", "galão", "balde", "saco"];

// ─── Progresso e resumo do fechamento ────────────────────────────────────────
const chave = (insumoId, estoqueId) => `${insumoId}|${estoqueId || ""}`;
export { chave as chaveItem };

/**
 * produtos: o que existe para contar (estoque_itens: insumo × local).
 * itens: o que já foi contado (linhas de estoque_contagens_itens).
 */
export function progressoContagem(produtos, itens) {
  const contados = new Map((itens || []).map((i) => [chave(i.insumo_id, i.estoque_id), i]));
  const lista = produtos || [];
  const doEscopo = lista.filter((p) => contados.has(chave(p.insumo_id, p.estoque_id)));
  const total = lista.length;
  const feitos = doEscopo.length;
  return {
    total, contados: feitos, naoContados: total - feitos,
    zerados: (itens || []).filter((i) => Number(i.quantidade_contada) === 0).length,
    foraDaLista: (itens || []).length - feitos,      // contado pela busca, sem vínculo com o local
    pct: total ? Math.floor((feitos / total) * 100) : 0,
  };
}

/** O que a tela de FINALIZAR mostra, por local e no total. */
export function resumoFechamento({ produtos, itens, pendencias, estoques }) {
  const geral = progressoContagem(produtos, itens);
  const porLocal = (estoques || []).map((e) => {
    const p = progressoContagem((produtos || []).filter((x) => x.estoque_id === e.id), (itens || []).filter((x) => x.estoque_id === e.id));
    return { estoque_id: e.id, nome: e.nome, ...p };
  }).filter((l) => l.total > 0 || l.contados > 0 || l.foraDaLista > 0);
  const abertas = (pendencias || []).filter((p) => (p.status || "pendente") === "pendente");
  return {
    ...geral,
    contadosTotal: (itens || []).length,
    pendencias: abertas.length,
    porLocal,
    precisaConfirmar: geral.naoContados > 0 || abertas.length > 0,
  };
}

// ─── Custo para valorizar no fechamento ──────────────────────────────────────
const CONTAVEIS = ["un", "unidade", "garrafa", "lata", "barril", "caixa", "cx", "pacote", "fardo", "maco", "maço", "galão", "balde", "saco"];
const conteudoEmMedida = (insumo) => ["ml", "g", "l", "kg"].includes(String(insumo?.unidade_conteudo || "").toLowerCase()) || Number(insumo?.volume_unidade_ml) > 0;

/**
 * Custo sugerido por UNIDADE DO CADASTRO (R$/kg, R$/L, R$/garrafa…), com a
 * origem e uma conferência: o cadastro guarda o custo unitário e o preço da
 * embalagem; se os dois não batem, o custo é marcado DIVERGENTE e não é
 * aplicado sozinho. Custo médio de compras (F2.1) tem prioridade quando existir.
 *   situacao: "ok" | "unico" (só um valor, sem conferência) | "divergente" | "sem_custo"
 */
export function custoSugerido(insumo, custoMedioBase = null) {
  const uc = unidadeContagem(insumo?.unidade_medida);
  if (custoMedioBase != null && Number(custoMedioBase) > 0) {
    return { situacao: "ok", porUnidade: Number(custoMedioBase) * uc.fator, origem: "custo médio das compras", opcoes: [] };
  }
  const unitario = Number(insumo?.custo_unitario) > 0 ? Number(insumo.custo_unitario) : null;
  const compra = Number(insumo?.custo_compra) > 0 ? Number(insumo.custo_compra) : null;
  const tam = Number(insumo?.tamanho_embalagem) > 0 ? Number(insumo.tamanho_embalagem) : null;
  const u = String(insumo?.unidade_medida || "").toLowerCase();
  // preço da embalagem → por unidade do cadastro. Em peça (garrafa/lata/un) cujo
  // tamanho é o CONTEÚDO (ml/g), a embalagem é a própria peça.
  let porEmbalagem = null;
  if (compra != null) {
    if (CONTAVEIS.includes(u) && conteudoEmMedida(insumo)) porEmbalagem = compra;
    else if (tam != null) porEmbalagem = compra / tam;
  }
  const data = insumo?.preco_atualizado_em ? String(insumo.preco_atualizado_em).slice(0, 10) : null;
  const opcoes = [
    unitario != null && { valor: unitario, origem: "custo unitário do cadastro" },
    porEmbalagem != null && { valor: porEmbalagem, origem: `preço da embalagem do cadastro (R$ ${compra.toFixed(2).replace(".", ",")}${tam && !(CONTAVEIS.includes(u) && conteudoEmMedida(insumo)) ? ` ÷ ${fmtQtd(tam)}` : ""})` },
  ].filter(Boolean);
  if (!opcoes.length) return { situacao: "sem_custo", porUnidade: null, origem: null, opcoes, data };
  if (opcoes.length === 1) return { situacao: "unico", porUnidade: opcoes[0].valor, origem: opcoes[0].origem, opcoes, data };
  const batem = Math.abs(unitario - porEmbalagem) <= Math.max(0.01, 0.02 * Math.max(unitario, porEmbalagem));
  return batem
    ? { situacao: "ok", porUnidade: unitario, origem: "cadastro do insumo (custo unitário = preço da embalagem)", opcoes, data }
    : { situacao: "divergente", porUnidade: null, origem: null, opcoes, data };
}

// ─── Banco ───────────────────────────────────────────────────────────────────
const TIPOS = TIPOS_CONTAGEM.map((t) => t.codigo);

/** Abre um inventário (status "aberta" = EM CONTAGEM). Se já existe um aberto do mesmo tipo e data, devolve ele. */
export async function criarContagem(db, { unidade_id, tipo, data_referencia, nota = "" }, { hoje = hojeLocal() } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  if (!TIPOS.includes(tipo)) return falha("Tipo de contagem inválido.");
  if (!dataValida(data_referencia)) return falha("Informe a data do inventário.");
  if (data_referencia > hoje) return falha("A data do inventário não pode ser futura.");
  const existente = await db.from("estoque_contagens").select("id, status")
    .eq("unidade_id", unidade_id).eq("tipo", tipo).eq("data_referencia", data_referencia).eq("status", "aberta");
  if (existente.error) return falha(erroDb(existente.error));
  if (existente.data?.length) return { data: { id: existente.data[0].id, ja_existia: true }, error: null };
  const fechada = await db.from("estoque_contagens").select("id")
    .eq("unidade_id", unidade_id).eq("tipo", tipo).eq("data_referencia", data_referencia).eq("status", "fechada");
  if (fechada.error) return falha(erroDb(fechada.error));
  if (fechada.data?.length) return falha("Já existe um inventário FECHADO deste tipo nesta data. Correções vão por ajuste.");
  const { data, error } = await db.from("estoque_contagens")
    .insert({ unidade_id, tipo, data_referencia, estoque_id: null, status: "aberta", observacao: escreverObs({ nota: String(nota || "").trim() }) })
    .select("id").single();
  if (error) return falha(erroDb(error));
  return { data: { id: data.id, ja_existia: false }, error: null };
}

/**
 * Grava (ou corrige, enquanto EM CONTAGEM) a quantidade de um produto num local.
 * quantidade: na unidade do cadastro (kg, L, un…). quantidade_sistema: saldo do
 * sistema naquele momento (guardado só na primeira gravação, nunca sobrescrito).
 */
export async function salvarItemContagem(db, p) {
  if (!db) return falha("Banco indisponível.");
  if (!p?.contagem_id || !p?.insumo_id) return falha("Produto ou inventário não informado.");
  if (!unidadeValida(p.unidade_id)) return falha("Selecione uma unidade.");
  const q = lerQuantidade(p.quantidade);
  if (q.erro) return falha(q.erro);
  const uc = unidadeContagem(p.unidade_medida);
  const qtdBase = paraBase(q.valor, p.unidade_medida);
  const sistema = p.quantidade_sistema == null || p.quantidade_sistema === "" || !Number.isFinite(Number(p.quantidade_sistema))
    ? null : paraBase(Number(p.quantidade_sistema), p.unidade_medida);
  const atualizar = async (id) => {
    const r = await db.from("estoque_contagens_itens").update({ quantidade_contada: qtdBase, unidade_base: uc.base })
      .eq("id", id).eq("contagem_id", p.contagem_id).select("id");
    if (r.error) return falha(erroDb(r.error));
    if (!r.data?.length) return falha("Não foi possível atualizar: o inventário pode ter sido fechado.");
    return { data: { id, quantidade_contada: qtdBase, unidade_base: uc.base, novo: false }, error: null };
  };
  if (p.item_id) return atualizar(p.item_id);
  const ins = await db.from("estoque_contagens_itens").insert({
    unidade_id: p.unidade_id, contagem_id: p.contagem_id, insumo_id: p.insumo_id, estoque_id: p.estoque_id || null,
    quantidade_contada: qtdBase, unidade_base: uc.base, quantidade_sistema: sistema,
  }).select("id").single();
  if (!ins.error) return { data: { id: ins.data.id, quantidade_contada: qtdBase, unidade_base: uc.base, novo: true }, error: null };
  if (ins.error.code !== "23505") return falha(erroDb(ins.error));
  // já contado (outro aparelho/retry): corrige a mesma linha
  const { data: achados, error } = await db.from("estoque_contagens_itens").select("id, estoque_id")
    .eq("contagem_id", p.contagem_id).eq("insumo_id", p.insumo_id);
  if (error) return falha(erroDb(error));
  const alvo = (achados || []).find((x) => (x.estoque_id || null) === (p.estoque_id || null));
  if (!alvo) return falha("Item já contado, mas não foi encontrado para corrigir.");
  return atualizar(alvo.id);
}

/** Lê a contagem e reescreve a observação com controle de concorrência (updated_at). */
async function alterarObs(db, contagemId, alterar) {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    // updated_at como texto: preserva os microssegundos para a comparação
    const { data: c, error } = await db.from("estoque_contagens").select("id, status, observacao, updated_at::text").eq("id", contagemId).single();
    if (error) return falha(erroDb(error));
    if (c.status !== "aberta") return falha("Este inventário não está mais em contagem.");
    const obs = alterar(lerObs(c.observacao));
    if (obs?.erro) return falha(obs.erro);
    const r = await db.from("estoque_contagens").update({ observacao: escreverObs(obs) })
      .eq("id", contagemId).eq("status", "aberta").eq("updated_at", c.updated_at).select("id");
    if (r.error) return falha(erroDb(r.error));
    if (r.data?.length) return { data: obs, error: null };
  }
  return falha("Outra pessoa alterou este inventário ao mesmo tempo. Tente de novo.");
}

/** Produto achado na contagem que NÃO está cadastrado: fica PENDENTE DE CADASTRO, sem criar insumo. */
export async function adicionarPendencia(db, { contagem_id, nome, unidade, estoque_id = null, quantidade, registrado_por = null }) {
  if (!db) return falha("Banco indisponível.");
  const n = String(nome || "").trim();
  if (n.length < 2) return falha("Informe o nome do produto.");
  if (!UNIDADES_PENDENCIA.includes(unidade)) return falha("Escolha a unidade em que contou.");
  const q = lerQuantidade(quantidade);
  if (q.erro) return falha(q.erro);
  const item = { id: novaChave(), nome: n, unidade, estoque_id: estoque_id || null, quantidade: q.valor, status: "pendente", registrado_em: new Date().toISOString(), registrado_por };
  const r = await alterarObs(db, contagem_id, (o) => ({ ...o, pendencias: [...o.pendencias, item] }));
  return r.error ? r : { data: item, error: null };
}

/** Pendência resolvida (o produto foi cadastrado e contado) ou descartada (lançada por engano). */
export async function marcarPendencia(db, { contagem_id, pendencia_id, status }) {
  if (!["resolvida", "descartada", "pendente"].includes(status)) return falha("Situação inválida.");
  return alterarObs(db, contagem_id, (o) => {
    if (!o.pendencias.some((p) => p.id === pendencia_id)) return { erro: "Pendência não encontrada." };
    return { ...o, pendencias: o.pendencias.map((p) => (p.id === pendencia_id ? { ...p, status, atualizado_em: new Date().toISOString() } : p)) };
  });
}

/**
 * FINALIZAR: grava o custo de cada item (congelado) e fecha. O banco recusa
 * fechar sem itens ou com item sem custo, e depois de fechado nada muda.
 * custos: Map/obj item_id → { porUnidade (R$ por unidade do cadastro), origem }.
 * Itens com quantidade 0 não precisam de custo (valor 0): gravam 0 e a origem.
 */
export async function fecharContagem(db, { contagem_id, itens, unidadesPorInsumo, custos, confirmado }) {
  if (!db) return falha("Banco indisponível.");
  if (!confirmado) return falha("Confirme o fechamento: depois de fechado, o inventário não muda mais.");
  if (!itens?.length) return falha("Inventário sem nenhum produto contado não pode ser fechado.");
  const get = (id) => (custos instanceof Map ? custos.get(id) : custos?.[id]);
  const temCusto = (c) => c != null && c.porUnidade != null && c.porUnidade !== "" && Number.isFinite(lerValor(c.porUnidade)) && lerValor(c.porUnidade) >= 0;
  const faltando = itens.filter((i) => Number(i.quantidade_contada) > 0 && !temCusto(get(i.id)));
  if (faltando.length) return falha(`${faltando.length} produto(s) contado(s) sem custo. Informe o custo antes de fechar.`);
  for (const i of itens) {
    const c = get(i.id);
    const zero = Number(i.quantidade_contada) === 0;
    const porUnidade = temCusto(c) ? Number(lerValor(c.porUnidade)) : (zero ? 0 : NaN);
    if (!Number.isFinite(porUnidade) || porUnidade < 0) return falha("Custo inválido em um dos produtos.");
    const custoBase = Math.round((porUnidade / unidadeContagem(unidadesPorInsumo?.[i.insumo_id]).fator) * 1e6) / 1e6;
    const origem = zero && !temCusto(c) ? "quantidade zero: custo não se aplica" : (c?.origem || "informado no fechamento");
    const r = await db.from("estoque_contagens_itens").update({ custo_unitario: custoBase, observacao: `custo: ${origem}` })
      .eq("id", i.id).eq("contagem_id", contagem_id).select("id");
    if (r.error) return falha(erroDb(r.error));
    if (!r.data?.length) return falha("Um dos produtos não pôde ser valorizado (o inventário pode ter sido fechado por outra pessoa).");
  }
  const f = await db.from("estoque_contagens").update({ status: "fechada" }).eq("id", contagem_id).eq("status", "aberta").select("id, status, fechada_em");
  if (f.error) return falha(erroDb(f.error));
  if (!f.data?.length) return falha("Este inventário não está mais em contagem.");
  return { data: f.data[0], error: null };
}

export async function cancelarContagem(db, { contagem_id, motivo }) {
  const m = String(motivo || "").trim();
  if (!m) return falha("Informe o motivo do cancelamento.");
  const r = await alterarObs(db, contagem_id, (o) => ({ ...o, nota: `${o.nota ? `${o.nota}\n` : ""}Cancelado: ${m}` }));
  if (r.error) return r;
  const c = await db.from("estoque_contagens").update({ status: "cancelada" }).eq("id", contagem_id).eq("status", "aberta").select("id");
  if (c.error) return falha(erroDb(c.error));
  if (!c.data?.length) return falha("Este inventário não está mais em contagem.");
  return { data: { id: contagem_id }, error: null };
}

// ─── Fila offline (salvamento progressivo) ───────────────────────────────────
/** Junta uma gravação na fila local: a mais recente do mesmo produto/local substitui a anterior. */
export function enfileirar(fila, op) {
  const k = chave(op.insumo_id, op.estoque_id);
  return [...(fila || []).filter((x) => chave(x.insumo_id, x.estoque_id) !== k), { ...op, enfileirado_em: op.enfileirado_em || new Date().toISOString() }];
}

// ─── Comparação entre dois inventários (diferença FÍSICA, não é consumo) ────
export function compararContagens(itensAnterior, itensAtual) {
  const mapa = new Map();
  for (const i of itensAnterior || []) mapa.set(chave(i.insumo_id, i.estoque_id), { insumo_id: i.insumo_id, estoque_id: i.estoque_id, anterior: Number(i.quantidade_contada), atual: null, unidade_base: i.unidade_base });
  for (const i of itensAtual || []) {
    const k = chave(i.insumo_id, i.estoque_id);
    mapa.set(k, { ...(mapa.get(k) || { insumo_id: i.insumo_id, estoque_id: i.estoque_id, anterior: null }), atual: Number(i.quantidade_contada), unidade_base: i.unidade_base });
  }
  return [...mapa.values()].map((l) => ({ ...l, diferenca: l.anterior != null && l.atual != null ? r3(l.atual - l.anterior) : null }));
}

/** Valor do inventário (só itens com custo congelado). */
export function valorContagem(itens) {
  const comCusto = (itens || []).filter((i) => i.custo_unitario != null);
  return { valor: r2(comCusto.reduce((s, i) => s + Number(i.valor_total ?? Number(i.quantidade_contada) * Number(i.custo_unitario)), 0)), semCusto: (itens || []).length - comCusto.length };
}
