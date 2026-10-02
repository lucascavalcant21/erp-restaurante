// Leitura e escrita da CONTAGEM DE ESTOQUE (F2.4A) com o cliente do app.
// Regras e validações ficam em contagem-estoque.mjs (testadas); aqui só se
// passa o `supabase` e se busca o que a tela precisa. Só leitura de estoques,
// estoque_itens e insumos: a contagem NÃO mexe no saldo do controle de estoque.

import { supabase, isSupabaseReady } from "./supabase.js";
import {
  criarContagem, salvarItemContagem, adicionarPendencia, marcarPendencia, fecharContagem, cancelarContagem,
} from "./contagem-estoque.mjs";
import { unidadeValida } from "./contas-pagar.mjs";
import { registrarContagemMulti } from "./estoques-multiplos";
import { planoDeAplicacao, faltandoAplicar, marcadorInventario, observacaoDoAjuste } from "./inventario-saldo.mjs";

const CAMPOS_INSUMO = "id, nome, nome_interno, unidade_medida, categoria, codigo_interno, departamento, custo_unitario, custo_compra, tamanho_embalagem, unidade_comercial, unidade_conteudo, volume_unidade_ml, preco_atualizado_em";
// permite_fracionado decide se o produto é contado em "fechadas + aberta". Se a
// coluna faltar num banco antigo, a contagem segue sem ela (tudo por unidade).
const CAMPOS_INSUMO_FRAC = `${CAMPOS_INSUMO}, permite_fracionado`;
async function lerInsumos(unidadeId) {
  const r = await supabase.from("insumos").select(CAMPOS_INSUMO_FRAC).eq("unidade_id", unidadeId).order("nome");
  if (r.error && /permite_fracionado/i.test(r.error.message || "")) {
    return supabase.from("insumos").select(CAMPOS_INSUMO).eq("unidade_id", unidadeId).order("nome");
  }
  return r;
}

/** Tudo o que a tela de contagem precisa: locais, produtos por local, cadastro completo (busca) e custos médios. */
export async function fetchBaseContagem(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: null, error: "Selecione uma unidade." };
  const [e, ei, ins, cm] = await Promise.all([
    supabase.from("estoques").select("id, nome, slug, tipo, status, ordem").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem").order("nome"),
    supabase.from("estoque_itens").select("id, estoque_id, insumo_id, quantidade_atual, local_interno").eq("unidade_id", unidadeId),
    lerInsumos(unidadeId),
    supabase.from("estoque_custos").select("insumo_id, custo_medio_base, atualizado_em").eq("unidade_id", unidadeId),
  ]);
  const erro = [e.error, ei.error, ins.error].find(Boolean);
  if (erro) return { data: null, error: erro.message };
  return {
    data: {
      estoques: e.data || [],
      vinculos: ei.data || [],
      insumos: ins.data || [],
      custosMedios: Object.fromEntries((cm.data || []).map((c) => [c.insumo_id, Number(c.custo_medio_base)])),
    },
    error: null,
  };
}

export async function fetchContagens(unidadeId) {
  if (!isSupabaseReady() || !unidadeValida(unidadeId)) return { data: [], error: null };
  const { data, error } = await supabase.from("estoque_contagens").select("*").eq("unidade_id", unidadeId)
    .order("data_referencia", { ascending: false }).order("created_at", { ascending: false });
  return { data: data || [], error: error?.message || null };
}

export async function fetchContagem(id) {
  if (!isSupabaseReady() || !id) return { data: null, error: "Inventário não informado." };
  const { data, error } = await supabase.from("estoque_contagens").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "Inventário não encontrado nesta unidade." };
  return { data, error: null };
}

export async function fetchItensContagem(contagemIds) {
  const ids = (Array.isArray(contagemIds) ? contagemIds : [contagemIds]).filter(Boolean);
  if (!isSupabaseReady() || !ids.length) return { data: [], error: null };
  const { data, error } = await supabase.from("estoque_contagens_itens")
    .select("id, contagem_id, insumo_id, estoque_id, quantidade_contada, unidade_base, quantidade_sistema, custo_unitario, valor_total, observacao, criado_por, atualizado_por, updated_at")
    .in("contagem_id", ids);
  return { data: data || [], error: error?.message || null };
}

const semBanco = { data: null, error: "Offline" };
export const abrirContagem = (p) => (isSupabaseReady() ? criarContagem(supabase, p) : semBanco);
export const gravarItemContagem = (p) => (isSupabaseReady() ? salvarItemContagem(supabase, p) : semBanco);
export const registrarPendencia = (p) => (isSupabaseReady() ? adicionarPendencia(supabase, p) : semBanco);
export const alterarPendencia = (p) => (isSupabaseReady() ? marcarPendencia(supabase, p) : semBanco);
export const finalizarContagem = (p) => (isSupabaseReady() ? fecharContagem(supabase, p) : semBanco);
export const descartarContagem = (p) => (isSupabaseReady() ? cancelarContagem(supabase, p) : semBanco);

// ─── Inventário → saldo do estoque ───────────────────────────────────────────

const fmtDataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");

/** Acertos de saldo já gravados por este inventário (para não aplicar duas vezes). */
async function acertosDoInventario(unidadeId, contagemId) {
  const { data, error } = await supabase.from("estoque_movimentacoes_multi")
    .select("estoque_id, insumo_id, tipo, observacao")
    .eq("unidade_id", unidadeId).eq("tipo", "contagem")
    .ilike("observacao", `%${marcadorInventario(contagemId)}%`);
  return { data: data || [], error: error?.message || null };
}

/** Quantos produtos do inventário já estão no saldo e quantos faltam. */
export async function situacaoNoSaldo({ unidadeId, contagem, itens, insumoPorId, daBase }) {
  if (!isSupabaseReady() || !contagem?.id) return { data: null, error: "Offline" };
  const plano = planoDeAplicacao(itens, insumoPorId, daBase);
  const { data: movs, error } = await acertosDoInventario(unidadeId, contagem.id);
  if (error) return { data: null, error };
  const faltando = faltandoAplicar(plano, movs, contagem.id);
  return { data: { total: plano.aplicar.length, aplicados: plano.aplicar.length - faltando.length, faltando: faltando.length, semLocal: plano.semLocal }, error: null };
}

/**
 * O saldo de cada produto contado passa a ser o contado, pelo mesmo acerto de
 * contagem do Controle de Estoque (saldo anterior → novo, quem, quando, lotes).
 * Só grava o que ainda não foi gravado por este inventário: reaplicar depois
 * de uma falha de rede não duplica.
 */
export async function aplicarInventarioAoSaldo({ unidadeId, contagem, itens, insumoPorId, daBase, usuarioId = null, usuarioNome = "" }) {
  if (!isSupabaseReady() || !contagem?.id) return { data: null, error: "Offline" };
  if (contagem.status !== "fechada") return { data: null, error: "Só inventário fechado vai para o saldo." };
  const plano = planoDeAplicacao(itens, insumoPorId, daBase);
  const { data: movs, error } = await acertosDoInventario(unidadeId, contagem.id);
  if (error) return { data: null, error };
  const faltando = faltandoAplicar(plano, movs, contagem.id);
  const observacao = observacaoDoAjuste(contagem, fmtDataBR);
  let aplicados = 0;
  const falhas = [];
  for (const p of faltando) {
    const r = await registrarContagemMulti({
      unidadeId, estoqueId: p.estoque_id, insumoId: p.insumo_id, saldoContado: p.saldo,
      usuarioId, usuarioNome, observacao,
    });
    if (r?.error) falhas.push({ nome: p.nome, erro: r.error }); else aplicados += 1;
  }
  return {
    data: { aplicados, jaEstavam: plano.aplicar.length - faltando.length, falhas, semLocal: plano.semLocal },
    error: null,
  };
}
