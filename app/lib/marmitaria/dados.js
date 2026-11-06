// Acesso a dados da Marmitaria & Delivery.
//
// Reusa o que o ERP já tem — fichas e ingredientes (operacao.js), estoque
// (estoques-multiplos.js, estoque_transferir), contas a pagar (financeiro.js),
// RH (rh.js) — e chama as duas funções do banco da migração MARMITARIA-V2
// (marmitaria_salvar_ficha, marmitaria_registrar_producao). Conta e regra de
// negócio ficam em nucleo.mjs; aqui só se lê e se grava.

import { supabase, isSupabaseReady } from "../supabase";
import { fetchFichas, salvarInsumo } from "../operacao";
import { calcularPrecoNormalizado } from "../ingredientes-utils.mjs";
import { confirmarCompra, salvarRascunho } from "../compras-estoque.mjs";
import { UNIDADE_MARMITARIA } from "./acesso.mjs";
import { vincularItemEstoque } from "../estoques-multiplos";
import { transferirLancamento } from "../estoque-movimento-dados";
import { novaChave } from "../estoque-movimento.mjs";
import { fetchContasPagar } from "../financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade, inserirColaborador } from "../rh";
import { normalizarCanal } from "./nucleo.mjs";
import { fetchResultadoMensal } from "../parametros";
import { parametrosDoResultado, configComResultado } from "../resultado-mes.mjs";

export { novaChave };

export const MSG_MIGRACAO = "O banco ainda não recebeu a atualização da Marmitaria (MARMITARIA-V2). Avise o administrador para aplicá-la.";
const SEM_BANCO = "Sem conexão com o banco. Seus dados continuam na tela: tente salvar de novo.";
export const ESTOQUE_MARMITARIA = "marmitaria";
export const ESTOQUE_EMBALAGENS = "embalagens-marmitaria";

const unidadeOk = (u) => !!u && u !== "todas" && u !== "matriz";

export function migracaoPendente(msg) {
  return /could not find the function|function .*marmitaria_.* does not exist|PGRST202|column .*(canais|encargos|rateio|tributos_pct|centros_diretos)|marmitaria_vendas.*(does not exist|schema cache)|relation .*marmitaria_vendas/i.test(String(msg || ""));
}

// Erro do banco → texto para o dono. As funções novas já falam português.
export function mensagemErro(error) {
  if (!error) return null;
  const msg = String(error.message || error || "");
  if (migracaoPendente(msg)) return MSG_MIGRACAO;
  if (/Failed to fetch|NetworkError|network|timeout/i.test(msg)) return SEM_BANCO;
  if (/row-level security|permission denied/i.test(msg)) return "Sem permissão para gravar nesta unidade.";
  if (/duplicate key/i.test(msg)) return "Já existe um registro igual. Recarregue a tela e confira.";
  return msg;
}

// ─── Base do módulo ──────────────────────────────────────────────────────────

/**
 * Tudo que as telas da marmitaria precisam numa leitura só.
 * Marmita = ficha com departamento 'marmitaria'. Pré-preparo = eh_base (da
 * cozinha ou do bar: base compartilhada, sem cópia).
 */
export async function carregarBase(unidadeId) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const [fichasR, insR, embR, precosR, cfgR, estR, itensR, unR, foraR, resR] = await Promise.all([
    fetchFichas(unidadeId),
    supabase.from("insumos").select("*").eq("unidade_id", unidadeId).is("arquivado_em", null).order("nome"),
    supabase.from("marmitaria_fichas_embalagens").select("*").eq("unidade_id", unidadeId),
    supabase.from("marmitaria_precificacao_canais").select("ficha_id, canal, preco_venda").eq("unidade_id", unidadeId),
    supabase.from("marmitaria_configuracoes").select("*").eq("unidade_id", unidadeId).maybeSingle(),
    supabase.from("estoques").select("*").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem"),
    supabase.from("estoque_itens").select("id, estoque_id, insumo_id, quantidade_atual, estoque_minimo, validade, local_interno, ficha_tecnica_id").eq("unidade_id", unidadeId),
    supabase.from("unidades").select("id, nome, ifood_conectado").eq("id", unidadeId).maybeSingle(),
    // fetchFichas só traz ficha ativa. Marmita fora do cardápio (ativo =
    // false) sumia da tela e não havia como devolvê-la ao cardápio.
    supabase.from("fichas_tecnicas").select("*, fichas_ingredientes!ficha_id(*, insumos(*))")
      .eq("unidade_id", unidadeId).eq("departamento", "marmitaria").eq("ativo", false).order("nome_receita"),
    // Impostos e meta de lucro da casa: Resultado do mês (substituiu a Pizza do Lucro).
    fetchResultadoMensal(unidadeId),
  ]);
  const erros = [
    fichasR.error && `Fichas: ${fichasR.error}`,
    insR.error && `Ingredientes: ${mensagemErro(insR.error)}`,
    estR.error && `Estoques: ${mensagemErro(estR.error)}`,
  ].filter(Boolean);
  const fichas = fichasR.data || [];
  const insumosLista = insR.data || [];
  const insumos = new Map(insumosLista.map((i) => [i.id, i]));
  const embPorFicha = new Map();
  for (const e of embR.data || []) {
    const l = embPorFicha.get(e.ficha_id) || [];
    l.push({ insumo_id: e.embalagem_insumo_id, quantidade: Number(e.quantidade) || 0, tipo: e.tipo_embalagem });
    embPorFicha.set(e.ficha_id, l);
  }
  const precosPorFicha = new Map();
  for (const p of precosR.data || []) {
    const m = precosPorFicha.get(p.ficha_id) || {};
    m[p.canal] = Number(p.preco_venda);
    precosPorFicha.set(p.ficha_id, m);
  }
  const foraDoCardapio = (foraR.data || []).filter((f) => !fichas.some((x) => x.id === f.id));
  const marmitas = [...fichas.filter((f) => f.departamento === "marmitaria"), ...foraDoCardapio]
    .map((f) => ({
      ...f,
      itens: (f.fichas_ingredientes || []).map((fi) => ({
        insumo_id: fi.insumo_id || null, subficha_id: fi.subficha_id || null,
        quantidade: Number(fi.quantidade) || 0, fator_correcao: Number(fi.fator_correcao) || 0,
      })),
      embalagens: (embPorFicha.get(f.id) || []).filter((e) => e.insumo_id),
      precos: precosPorFicha.get(f.id) || {},
    }));
  // espelho: pré-preparo ↔ item de estoque dele (trigger sincronizar_pre_preparo_ficha)
  const espelho = new Map(insumosLista.filter((i) => i.ficha_tecnica_id).map((i) => [i.ficha_tecnica_id, i.id]));
  const configRow = cfgR.data || null;
  const migracao = migracaoPendente(cfgR.error?.message) || migracaoPendente(precosR.error?.message);
  return {
    error: erros.length ? erros.join(" · ") : null,
    migracaoPendente: migracao || (configRow && !("canais" in configRow)),
    unidade: unR.data || null,
    fichas, marmitas,
    prePreparos: fichas.filter((f) => f.eh_base && f.departamento !== "marmitaria"),
    insumosLista, insumos, espelho,
    estoques: estR.data || [],
    itensEstoque: itensR.data || [],
    config: configComResultado(comUnidadePropria(normalizarConfig(configRow), unidadeId), parametrosDoResultado(resR?.data || {}, new Date().toISOString().slice(0, 7))),
    configSalva: !!configRow,
  };
}

export function normalizarConfig(row) {
  const r = row || {};
  const n = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    canais: (Array.isArray(r.canais) ? r.canais : []).map(normalizarCanal).filter((c) => c.id),
    tributos_pct: n(r.tributos_pct),
    margem_alvo_pct: row ? n(r.margem_lucro_alvo_pct) : null,
    encargos: r.encargos && typeof r.encargos === "object" ? r.encargos : {},
    rateio: r.rateio && typeof r.rateio === "object" ? r.rateio : {},
    centros_diretos: Array.isArray(r.centros_diretos) && r.centros_diretos.length ? r.centros_diretos : ["marmitaria"],
  };
}

// A unidade própria não divide conta com o restaurante.
const comUnidadePropria = (cfg, unidadeId) => (unidadeId === UNIDADE_MARMITARIA ? { ...cfg, centros_diretos: ["*"] } : cfg);

export async function salvarConfig(unidadeId, cfg) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const payload = {
    unidade_id: unidadeId,
    canais: (cfg.canais || []).map(normalizarCanal),
    tributos_pct: cfg.tributos_pct === "" || cfg.tributos_pct === null || cfg.tributos_pct === undefined ? null : Number(cfg.tributos_pct),
    margem_lucro_alvo_pct: cfg.margem_alvo_pct === "" || cfg.margem_alvo_pct === null || cfg.margem_alvo_pct === undefined ? null : Number(cfg.margem_alvo_pct),
    encargos: cfg.encargos || {},
    rateio: cfg.rateio || {},
    centros_diretos: cfg.centros_diretos?.length ? cfg.centros_diretos : ["marmitaria"],
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("marmitaria_configuracoes").upsert(payload, { onConflict: "unidade_id" });
  return { error: mensagemErro(error) };
}

// ─── Marmitas e pré-preparos ─────────────────────────────────────────────────

async function rpcFicha(dados) {
  if (!isSupabaseReady()) return { data: null, error: SEM_BANCO };
  try {
    const { data, error } = await supabase.rpc("marmitaria_salvar_ficha", { p_dados: dados });
    if (error) return { data: null, error: mensagemErro(error) };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: mensagemErro(e) };
  }
}

/** Grava a marmita inteira numa transação. `id` vem da tela (novaChave) e é reenviado igual em nova tentativa. */
export const salvarMarmita = (dados) => rpcFicha({ ...dados, tipo: "marmita" });
export const salvarPrePreparo = (dados) => rpcFicha({ ...dados, tipo: "pre_preparo" });

export async function definirDisponibilidade(fichaId, ativo) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const { error } = await supabase.from("fichas_tecnicas").update({ ativo: !!ativo, atualizado_em: new Date().toISOString() }).eq("id", fichaId).eq("departamento", "marmitaria");
  return { error: mensagemErro(error) };
}

/**
 * Ingrediente ou embalagem novo pelo cadastro oficial (salvarInsumo): trava de
 * nome repetido, histórico de preço e vínculo no estoque vêm junto.
 */
export async function criarProduto({ unidadeId, nome, marca = "", unidade_medida, preco_embalagem, tamanho_embalagem, departamento = "marmitaria", categoria = "" }) {
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const nomeLimpo = String(nome || "").trim();
  if (nomeLimpo.length < 2) return { error: "Informe o nome do produto." };
  const preco = Number(preco_embalagem);
  const tamanho = Number(tamanho_embalagem) || 1;
  if (!(preco >= 0)) return { error: "Informe o preço de compra." };
  const r = await salvarInsumo({
    unidade_id: unidadeId, nome: nomeLimpo, nome_interno: nomeLimpo, marca: String(marca || "").trim() || null, departamento,
    categoria: categoria || (departamento === "embalagens" ? "Embalagens" : "Marmitaria"),
    tipo: departamento === "embalagens" ? "embalagem" : departamento === "limpeza" ? "limpeza" : "ingrediente",
    unidade_medida, unidade_comercial: unidade_medida, tamanho_embalagem: tamanho,
    custo_compra: preco, valor_embalagem: preco,
  }, { origem: "marmitaria" });
  if (r?.error) return { error: mensagemErro(r.error) };
  return { id: r?.id || null, error: null };
}

/** Mudanças de preço desde uma data: vêm do cadastro e do recebimento de compras. */
export async function fetchHistoricoPrecos(unidadeId, desde) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [] };
  const { data, error } = await supabase.from("insumos_precos_historico").select("*").eq("unidade_id", unidadeId).gte("created_at", desde).order("created_at");
  return { data: data || [], error: mensagemErro(error) };
}

/** Descrição que o cliente lê. Vai nos dois campos, como a marmitaria_salvar_ficha faz. */
export async function salvarDescricao(fichaId, descricao) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const texto = String(descricao || "").trim() || null;
  const { error } = await supabase.from("fichas_tecnicas").update({ descricao: texto, descricao_comercial: texto, atualizado_em: new Date().toISOString() }).eq("id", fichaId).eq("departamento", "marmitaria");
  return { error: mensagemErro(error) };
}

/** Novo preço de compra de uma embalagem: passa pelo salvarInsumo para ficar no histórico de preço. */
export async function atualizarPrecoEmbalagem({ id, marca, unidade_medida, preco_embalagem, tamanho_embalagem }) {
  const preco = Number(preco_embalagem);
  const tamanho = Number(tamanho_embalagem);
  if (!(preco >= 0)) return { error: "Informe o preço de compra." };
  if (!(tamanho > 0)) return { error: "Informe quanto vem na embalagem de compra." };
  // O preço normalizado vai junto: é ele que o custo das fichas lê primeiro.
  const r = await salvarInsumo({ id, custo_compra: preco, valor_embalagem: preco, tamanho_embalagem: tamanho,
    preco_normalizado: calcularPrecoNormalizado(tamanho, unidade_medida, preco),
    ...(marca === undefined ? {} : { marca: String(marca || "").trim() || null }) }, { origem: "marmitaria" });
  return { error: r?.error ? mensagemErro(r.error) : null };
}

/** Preço de um item numa plataforma. A unidade vem da sessão e a RLS confere. */
export async function salvarPrecoNoCanal({ unidadeId, fichaId, canal, preco }) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const valor = Number(preco);
  if (!(valor > 0)) return { error: "Informe um preço maior que zero." };
  const { error } = await supabase.from("marmitaria_precificacao_canais").upsert(
    { unidade_id: unidadeId, ficha_id: fichaId, canal, preco_venda: valor, atualizado_em: new Date().toISOString() },
    { onConflict: "unidade_id,ficha_id,canal" });
  return { error: mensagemErro(error) };
}


// ─── Compras da marmitaria ──────────────────────────────────────────────────
// Usam as compras oficiais: o pedido é um rascunho com a previsão de chegada e,
// ao receber, compras_confirmar dá a entrada no estoque e atualiza o custo.

export async function fetchPedidos(unidadeId, estoqueIds) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId) || !estoqueIds?.length) return { compras: [], itens: [] };
  const it = await supabase.from("compras_itens").select("*").eq("unidade_id", unidadeId).in("estoque_id", estoqueIds);
  if (it.error) return { compras: [], itens: [], error: mensagemErro(it.error) };
  const ids = [...new Set((it.data || []).map((i) => i.compra_id))];
  if (!ids.length) return { compras: [], itens: [] };
  const c = await supabase.from("compras").select("*").in("id", ids);
  return { compras: c.data || [], itens: it.data || [], error: mensagemErro(c.error) };
}

export async function criarPedido({ unidadeId, itens, chegada, hoje, chave }) {
  const r = await salvarRascunho(supabase, {
    compra: { unidade_id: unidadeId, data_compra: hoje, data_recebimento: chegada },
    itens: itens.map((i) => ({ insumo: i.insumo, quantidade: i.quantidade, valor_total: i.valor, quantidade_pedida: i.quantidade, valor_pedido: i.valor, estoque_id: i.estoque_id })),
    chave,
  }, { hoje, aceitaPrevisao: true });
  return { id: r.data?.id || null, error: r.error ? mensagemErro(r.error) : null };
}

/** Conferiu: grava o que chegou de verdade e lança no estoque. Item com zero não chegou. */
export async function receberPedido({ unidadeId, compra, linhas, hoje, vencimento }) {
  const itens = linhas.filter((l) => Number(l.recebida) > 0).map((l) => ({
    insumo: l.insumo, quantidade: l.recebida, valor_total: l.valor, quantidade_pedida: l.item.quantidade_pedida_embalagens, valor_pedido: l.item.valor_pedido, estoque_id: l.item.estoque_id,
    lote: l.item.lote, validade: l.validade || l.item.validade,
  }));
  if (!itens.length) return { error: "Informe a quantidade que chegou." };
  const salvo = await salvarRascunho(supabase, { compra: { id: compra.id, unidade_id: unidadeId, data_compra: compra.data_compra, data_recebimento: hoje }, itens }, { hoje });
  if (salvo.error) return { error: mensagemErro(salvo.error) };
  const r = await confirmarCompra(supabase, { compra_id: compra.id, gerar_conta_pagar: true, data_vencimento: vencimento || hoje });
  return { error: r.error ? mensagemErro(r.error) : null };
}

// ─── Cozinha da marmitaria ──────────────────────────────────────────────────

export async function retirarDoEstoque({ unidadeId, estoqueId, insumoId, quantidadeSaldo, quantidade, unidade, motivo, chave }) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const { data, error } = await supabase.rpc("estoque_movimentar", {
    p_unidade_id: unidadeId, p_estoque_id: estoqueId, p_insumo_id: insumoId, p_tipo: "saida", p_motivo: motivo, p_quantidade: quantidadeSaldo,
    p_quantidade_informada: quantidade, p_unidade_informada: unidade, p_observacao: "Retirada na marmitaria", p_chave: chave,
  });
  if (error) return { error: mensagemErro(error) };
  return { error: data?.ok === false ? data.erro || "Retirada recusada." : null };
}

export async function produzirPreparo(dados) {
  if (!isSupabaseReady()) return { data: null, error: SEM_BANCO };
  const { data, error } = await supabase.rpc("marmitaria_produzir_preparo", { p_dados: dados });
  return { data, error: mensagemErro(error) };
}

export async function fetchPreparosDoDia(unidadeId, dia) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [] };
  const { data, error } = await supabase.from("marmitaria_producao_lotes").select("id, ficha_id, quantidade_produzida, data_producao, data_validade, rendimento_real_dados")
    .eq("unidade_id", unidadeId).eq("tipo_demanda", "preparo").eq("data_producao", dia);
  return { data: data || [], error: mensagemErro(error) };
}

const PLANO_COZINHA = "cozinha";

export async function fetchPlanosDaCozinha(unidadeId, dias) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [] };
  const { data, error } = await supabase.from("marmitaria_planos_operacionais").select("id, data_planejada, dados_completos")
    .eq("unidade_id", unidadeId).eq("periodo_tipo", PLANO_COZINHA).in("data_planejada", dias);
  return { data: data || [], error: mensagemErro(error) };
}

export async function salvarPlanoDaCozinha({ id, unidadeId, dia, itens }) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const { error } = await supabase.from("marmitaria_planos_operacionais").upsert({
    id, unidade_id: unidadeId, data_planejada: dia, periodo_tipo: PLANO_COZINHA, dados_completos: { itens }, updated_at: new Date().toISOString(),
  });
  return { error: mensagemErro(error) };
}

// ─── Estoque da marmitaria ───────────────────────────────────────────────────

/** Cria os dois locais da marmitaria (alimentos e embalagens). Idempotente. */
export async function ativarEstoques(unidadeId) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const agora = new Date().toISOString();
  const base = { unidade_id: unidadeId, status: "ativo", permissoes: [], controla_minimo: true, updated_at: agora };
  const { error } = await supabase.from("estoques").upsert([
    { ...base, nome: "Marmitaria", slug: ESTOQUE_MARMITARIA, tipo: "alimentos", descricao: "Insumos e pré-preparos da marmitaria", cor: "#047857", controla_validade: true, locais_internos: [], ordem: 20 },
    { ...base, nome: "Limpeza da Marmitaria", slug: "limpeza-marmitaria", tipo: "limpeza", descricao: "Produtos de limpeza da marmitaria", cor: "#047857", controla_validade: false, locais_internos: [], ordem: 13 },
    { ...base, nome: "Produção da Marmitaria", slug: "producao-marmitaria", tipo: "alimentos", descricao: "Subprodutos prontos da marmitaria", cor: "#047857", controla_validade: true, controla_minimo: false, locais_internos: [], ordem: 12 },
    { ...base, nome: "Embalagens da Marmitaria", slug: ESTOQUE_EMBALAGENS, tipo: "embalagens", descricao: "Marmitex, tampas, sacolas, talheres e etiquetas", cor: "#047857", controla_validade: false, locais_internos: [], ordem: 21 },
  ], { onConflict: "unidade_id,slug", ignoreDuplicates: true });
  return { error: mensagemErro(error) };
}

export const vincularProduto = ({ unidadeId, estoqueId, insumoId, minimo = null }) =>
  vincularItemEstoque({ unidadeId, estoqueId, insumoId, minimo });

/** Transferência atômica (estoque_transferir) com chave idempotente da tela. */
export async function transferir({ unidadeId, origemId, destinoId, insumoId, quantidadeSaldo, observacao, chave }) {
  const r = await transferirLancamento({
    unidade_id: unidadeId, origem_id: origemId, destino_id: destinoId, insumo_id: insumoId,
    quantidade: quantidadeSaldo, observacao: observacao || "Transferência para a marmitaria", responsavel_nome: null, chave,
  });
  return { data: r.data, error: r.error ? mensagemErro(r.error) : null };
}

export async function registrarProducao(dados) {
  if (!isSupabaseReady()) return { data: null, error: SEM_BANCO };
  try {
    const { data, error } = await supabase.rpc("marmitaria_registrar_producao", { p_dados: dados });
    return { data, error: mensagemErro(error) };
  } catch (e) {
    return { data: null, error: mensagemErro(e) };
  }
}

export async function fetchProducoes(unidadeId, limite = 30) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [] };
  const { data, error } = await supabase.from("marmitaria_producao_lotes")
    .select("id, codigo, ficha_id, quantidade_produzida, quantidade_perdas, data_producao, custo_total, status")
    .eq("unidade_id", unidadeId).order("data_producao", { ascending: false }).limit(limite);
  return { data: data || [], error: mensagemErro(error) };
}

export async function fetchProducoesDoDia(unidadeId, dia) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [] };
  const { data, error } = await supabase.from("marmitaria_producao_lotes")
    .select("id, ficha_id, quantidade_produzida, quantidade_perdas, data_producao, status")
    .eq("unidade_id", unidadeId).eq("data_producao", dia);
  return { data: data || [], error: mensagemErro(error) };
}

// ─── Vendas ──────────────────────────────────────────────────────────────────

export async function fetchVendas(unidadeId, de, ate) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [], error: null };
  let q = supabase.from("marmitaria_vendas").select("*").eq("unidade_id", unidadeId);
  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  const { data, error } = await q.order("data", { ascending: false });
  return { data: (data || []).map(numerosVenda), error: mensagemErro(error), migracaoPendente: migracaoPendente(error?.message) };
}

const CAMPOS_VENDA = ["quantidade", "valor_bruto", "descontos", "cancelamentos", "tributos", "comissao", "taxa_pagamento", "entrega_subsidiada", "promocoes", "outras_taxas", "repasse_liquido"];
function numerosVenda(v) {
  const o = { ...v };
  for (const k of CAMPOS_VENDA) o[k] = v[k] === null || v[k] === undefined ? (k === "tributos" || k === "repasse_liquido" ? null : 0) : Number(v[k]);
  return o;
}

export async function salvarVenda(unidadeId, venda) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const payload = { unidade_id: unidadeId, data: venda.data, canal: venda.canal, ficha_id: venda.ficha_id || null, observacao: venda.observacao || null,
    taxas_estimadas: !!venda.taxas_estimadas, fonte: "manual" };
  for (const k of CAMPOS_VENDA) {
    const v = venda[k];
    payload[k] = v === "" || v === null || v === undefined ? (k === "tributos" || k === "repasse_liquido" ? null : 0) : Number(v);
  }
  const q = venda.id
    ? supabase.from("marmitaria_vendas").update(payload).eq("id", venda.id).eq("fonte", "manual")
    : supabase.from("marmitaria_vendas").insert(payload);
  const { error } = await q;
  return { error: mensagemErro(error) };
}

export async function excluirVenda(id) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const { error } = await supabase.from("marmitaria_vendas").delete().eq("id", id).eq("fonte", "manual");
  return { error: mensagemErro(error) };
}

/** Pedidos do dia com marmita. Só lê; quem grava é importarVendas, com a confirmação do usuário. */
export async function fetchPedidosDoDia(unidadeId, dia) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { pedidos: [], itens: [], fichasDeProduto: new Map(), jaImportadas: new Set() };
  const inicio = new Date(`${dia}T00:00:00`);
  const fim = new Date(inicio.getTime() + 86400000);
  const pedidosR = await supabase.from("pedidos").select("id, status, tipo_pedido, desconto, created_at")
    .eq("unidade_id", unidadeId).gte("created_at", inicio.toISOString()).lt("created_at", fim.toISOString());
  const pedidos = pedidosR.data || [];
  if (pedidosR.error || !pedidos.length) return { pedidos: [], itens: [], fichasDeProduto: new Map(), jaImportadas: new Set(), error: mensagemErro(pedidosR.error) };
  const itensR = await supabase.from("pedidos_itens").select("id, pedido_id, produto_id, quantidade, valor_unitario").in("pedido_id", pedidos.map((p) => p.id));
  const itens = itensR.data || [];
  const produtos = [...new Set(itens.map((i) => i.produto_id).filter(Boolean))];
  const [prodR, impR] = await Promise.all([
    produtos.length ? supabase.from("produtos").select("id, ficha_id").in("id", produtos) : { data: [] },
    supabase.from("marmitaria_vendas").select("referencia_externa").eq("unidade_id", unidadeId).eq("fonte", "importacao").eq("data", dia),
  ]);
  return {
    pedidos, itens,
    fichasDeProduto: new Map((prodR.data || []).filter((p) => p.ficha_id).map((p) => [p.id, p.ficha_id])),
    jaImportadas: new Set((impR.data || []).map((v) => String(v.referencia_externa))),
    error: mensagemErro(itensR.error || prodR.error || impR.error),
  };
}

export async function importarVendas(unidadeId, vendas) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const linhas = vendas.map((v) => ({ ...v, unidade_id: unidadeId, fonte: "importacao", taxas_estimadas: false }));
  const { error } = await supabase.from("marmitaria_vendas").insert(linhas);
  return { error: mensagemErro(error) };
}

// ─── Funcionários: cadastrados na própria marmitaria ─────────────────────────

export async function carregarEquipe(unidadeId) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { error: SEM_BANCO };
  const [col, aloc, rec, rhCfg] = await Promise.all([
    fetchColaboradores(unidadeId),
    supabase.from("marmitaria_rh_alocacoes").select("*").eq("unidade_id", unidadeId),
    fetchRecibosPrestacaoUnidade(unidadeId),
    supabase.from("rh_config_trabalhista").select("anexo_simples, rat_pct, fap, terceiros_pct").eq("unidade_id", unidadeId).maybeSingle(),
  ]);
  return {
    colaboradores: col.data || [],
    alocacoes: aloc.data || [],
    recibos: rec.data || [],
    rhConfig: rhCfg.data || null,
    error: [col.error, aloc.error && mensagemErro(aloc.error)].filter(Boolean).join(" · ") || null,
  };
}

/**
 * Funcionário novo da marmitaria (pedido do dono, 05/11/2026): nasce aqui, na
 * unidade da marmitaria, já com 100% do custo nela. Usa a tabela oficial do RH,
 * então ponto e recibos valem para ele também.
 */
export async function criarFuncionario(unidadeId, f) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  if (!unidadeOk(unidadeId)) return { error: "Selecione uma unidade." };
  const nome = String(f.nome || "").trim();
  const cargo = String(f.cargo || "").trim();
  if (nome.length < 2) return { error: "Informe o nome." };
  if (!cargo) return { error: "Informe a função." };
  const salario = Number(f.salario);
  if (!(salario >= 0)) return { error: "Informe o salário." };
  const vt = Number(f.vale_transporte) || 0;
  const r = await inserirColaborador({
    unidade_id: unidadeId, nome, cargo, salario, status: "ativo",
    vale_alimentacao: Number(f.vale_alimentacao) || 0,
    usa_vale_transporte: vt > 0, vale_transporte_val: vt > 0 ? vt : null,
    data_admissao: f.data_admissao || null,
  });
  if (r.error) return { error: /row-level security|permission denied/i.test(r.error) ? "Só quem tem acesso ao RH pode cadastrar funcionário." : mensagemErro(r.error) };
  const aloc = await salvarAlocacao(unidadeId, { colaborador_id: r.data.id, tipo_alocacao: "exclusivo", turno: f.turno });
  return { id: r.data.id, error: aloc.error || null };
}

export async function salvarAlocacao(unidadeId, a) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const payload = {
    unidade_id: unidadeId, colaborador_id: a.colaborador_id,
    tipo_alocacao: a.tipo_alocacao === "exclusivo" ? "exclusivo" : "compartilhado",
    percentual_tempo: a.tipo_alocacao === "exclusivo" ? 100 : Math.max(0, Math.min(100, Number(a.percentual_tempo) || 0)),
    horas_por_semana: a.horas_por_semana === "" || a.horas_por_semana === null || a.horas_por_semana === undefined ? null : Number(a.horas_por_semana),
    turno: a.turno || null, funcao_marmitaria: a.funcao_marmitaria || null, ativo: a.ativo !== false,
  };
  const { error } = await supabase.from("marmitaria_rh_alocacoes").upsert(payload, { onConflict: "unidade_id,colaborador_id" });
  return { error: mensagemErro(error) };
}

// ─── Financeiro (DRE) ────────────────────────────────────────────────────────

/** Contas, categorias, contagens e movimentos dos estoques da marmitaria. */
export async function carregarFinanceiro(unidadeId, estoqueIds = []) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { error: SEM_BANCO };
  const [contas, cats, cont, compras] = await Promise.all([
    fetchContasPagar(unidadeId),
    supabase.from("fin_categorias").select("codigo, nome, natureza"),
    estoqueIds.length ? supabase.from("estoque_contagens").select("id, tipo, data_referencia, status, estoque_id, fechada_em").eq("unidade_id", unidadeId).eq("status", "fechada").in("estoque_id", estoqueIds) : { data: [] },
    supabase.from("vw_compras").select("*").eq("unidade_id", unidadeId),
  ]);
  const idsCont = (cont.data || []).map((c) => c.id);
  const idsCompra = (compras.data || []).map((c) => c.id);
  const [itC, itCp, mov] = await Promise.all([
    idsCont.length ? supabase.from("estoque_contagens_itens").select("contagem_id, insumo_id, quantidade_contada, custo_unitario, valor_total").in("contagem_id", idsCont) : { data: [] },
    idsCompra.length ? supabase.from("compras_itens").select("compra_id, insumo_id, estoque_id, valor_total, quantidade_base, unidade_base").in("compra_id", idsCompra) : { data: [] },
    estoqueIds.length ? supabase.from("estoque_movimentacoes_multi").select("id, estoque_id, estoque_destino_id, transferencia_id, insumo_id, tipo, motivo, quantidade, valor_total, data_movimento, estorno_de_id").eq("unidade_id", unidadeId).in("estoque_id", estoqueIds) : { data: [] },
  ]);
  const itensPorContagem = new Map(idsCont.map((id) => [id, []]));
  for (const i of itC.data || []) itensPorContagem.get(i.contagem_id)?.push({ ...i, valor_total: i.valor_total == null ? null : Number(i.valor_total) });
  return {
    contas: contas.data || [],
    categorias: cats.data || [],
    contagens: (cont.data || []).map((c) => ({ ...c, data_referencia: String(c.data_referencia).slice(0, 10) })),
    itensPorContagem,
    compras: (compras.data || []).map((c) => ({ ...c, valor_total: Number(c.valor_total), valor_itens: Number(c.valor_itens) })),
    comprasItens: (itCp.data || []).map((i) => ({ ...i, valor_total: Number(i.valor_total), quantidade_base: Number(i.quantidade_base) })),
    movimentos: (mov.data || []).map((m) => ({ ...m, quantidade: Number(m.quantidade), valor_total: m.valor_total == null ? null : Number(m.valor_total) })),
    error: [contas.error, compras.error && mensagemErro(compras.error)].filter(Boolean).join(" · ") || null,
  };
}

// ─── Simulações salvas ───────────────────────────────────────────────────────

export async function fetchSimulacoes(unidadeId) {
  if (!isSupabaseReady() || !unidadeOk(unidadeId)) return { data: [] };
  const { data } = await supabase.from("marmitaria_simulacoes").select("id, nome, dias_operacao_mes, itens, resultado_consolidado, criado_em")
    .eq("unidade_id", unidadeId).order("criado_em", { ascending: false }).limit(20);
  return { data: data || [] };
}

export async function salvarSimulacao(unidadeId, { nome, diasMes, entradas, resultado }) {
  if (!isSupabaseReady()) return { error: SEM_BANCO };
  const { error } = await supabase.from("marmitaria_simulacoes").insert({
    unidade_id: unidadeId, nome: String(nome || "Simulação").slice(0, 80), dias_operacao_mes: Math.round(Number(diasMes) || 26),
    cenario_meta_diaria: Math.round(Number(entradas?.cenarios?.[0]) || 0), itens: entradas || {}, resultado_consolidado: resultado || {},
  });
  return { error: mensagemErro(error) };
}
