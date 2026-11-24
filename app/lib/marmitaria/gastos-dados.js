// Leitura e lançamento dos gastos da marmitaria (17/11/2026), pelo cliente do
// usuário (RLS do banco). As contas são de compras (Compras) ou do Financeiro;
// o gasto avulso (frigideira, avental, detergente…) é uma conta a pagar já paga
// (lancarContaPagar, o mesmo caminho do Financeiro) mais o detalhe em
// gastos_detalhe (GASTOS-1): item, quantidade, tipo e para quem.

import { supabase, isSupabaseReady } from "../supabase";
import { lancarContaPagar, hojeLocal } from "../contas-pagar.mjs";
import { categoriaDoTipo } from "./gastos.mjs";

const FUSO = "America/Sao_Paulo";
const diaLocal = (ts) => (ts ? new Date(ts).toLocaleDateString("sv-SE", { timeZone: FUSO }) : null);
const somarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ausente = (e) => /does not exist|schema cache|PGRST20[25]|could not find/i.test(`${e?.message || ""} ${e?.code || ""}`);
export const MSG_SEM_GASTOS_1 = "O banco desta unidade ainda não tem o detalhe dos gastos (migração GASTOS-1): os gastos avulsos aparecem só pela conta a pagar.";

/** Tudo do período (de/até em YYYY-MM-DD), mais o estoque de agora. */
export async function carregarGastos(unidadeId, { de, ate }) {
  if (!isSupabaseReady() || !unidadeId) return { error: "Selecione uma unidade." };
  // margem antes do período: compra feita antes e recebida dentro; conta vencida antes e paga dentro
  const antes = somarDias(de, -62);
  const depois = somarDias(ate, 62);
  const [comprasR, contasR, detR, movR, lotesR, colR, custosR] = await Promise.all([
    supabase.from("compras").select("id, status, data_compra, data_recebimento, valor_frete, valor_desconto, fornecedor_id, cancelado_em")
      .eq("unidade_id", unidadeId).gte("data_compra", antes).lte("data_compra", ate),
    supabase.from("contas_pagar").select("id, descricao, valor, categoria_codigo, status, data_pagamento, data_vencimento, origem_tipo, cancelado_em")
      .eq("unidade_id", unidadeId).gte("data_vencimento", antes).lte("data_vencimento", depois),
    supabase.from("gastos_detalhe").select("conta_pagar_id, data, tipo_gasto, item, quantidade, valor_total, destino, colaborador_id, observacao")
      .eq("unidade_id", unidadeId).gte("data", de).lte("data", ate),
    supabase.from("estoque_movimentacoes_multi").select("tipo, insumo_id, quantidade, unidade_medida, valor_total, motivo, data_movimento, chave_idempotencia")
      .eq("unidade_id", unidadeId).gte("data_movimento", `${somarDias(de, -1)}T00:00:00Z`).lte("data_movimento", `${somarDias(ate, 1)}T23:59:59Z`).limit(5000),
    supabase.from("marmitaria_producao_lotes").select("id, ficha_id, tipo_demanda, quantidade_produzida, data_producao, custo_total, rendimento_real_dados")
      .eq("unidade_id", unidadeId).gte("data_producao", de).lte("data_producao", ate),
    supabase.from("colaboradores").select("id, nome, status").eq("unidade_id", unidadeId).order("nome"),
    supabase.from("estoque_custos").select("insumo_id, custo_medio_base, unidade_base").eq("unidade_id", unidadeId),
  ]);
  const erro = comprasR.error || contasR.error || movR.error || lotesR.error;
  if (erro) return { error: erro.message };
  const compras = comprasR.data || [];
  const ids = compras.filter((c) => c.status === "confirmada").map((c) => c.id);
  const fornIds = [...new Set(compras.map((c) => c.fornecedor_id).filter(Boolean))];
  const [itensR, fornR] = await Promise.all([
    ids.length ? supabase.from("compras_itens").select("compra_id, insumo_id, estoque_id, descricao_snapshot, quantidade_base, unidade_base, valor_total").in("compra_id", ids) : { data: [] },
    fornIds.length ? supabase.from("fornecedores").select("id, nome").in("id", fornIds) : { data: [] },
  ]);
  const fornecedores = new Map((fornR.data || []).map((f) => [f.id, f.nome]));
  return {
    error: itensR.error?.message || null,
    semGastos1: !!detR.error && ausente(detR.error),
    compras: compras.map((c) => ({ ...c, fornecedor_nome: fornecedores.get(c.fornecedor_id) || null })),
    itensCompra: itensR.data || [],
    contas: contasR.data || [],
    detalhes: detR.error ? [] : detR.data || [],
    // a data do movimento no fuso da casa (um lançamento às 22h não pula de dia)
    movimentos: (movR.data || []).map((m) => ({ ...m, data_movimento: diaLocal(m.data_movimento) })),
    lotes: lotesR.data || [],
    colaboradores: (colR.data || []).filter((c) => (c.status || "ativo") === "ativo"),
    colaboradoresTodos: new Map((colR.data || []).map((c) => [c.id, c.nome])),
    custos: new Map((custosR.data || []).map((c) => [c.insumo_id, c])),
  };
}

/**
 * Lança um gasto avulso: conta a pagar já paga (Financeiro) + detalhe.
 * Uniforme para um funcionário também vai para a ficha dele (RH), se pedido.
 * @returns {{ error: string|null, aviso?: string }}
 */
export async function registrarGasto({ unidadeId, data, tipo, item, quantidade, valor, destino, colaboradorId, observacao, chave, naFicha = true }) {
  const hoje = hojeLocal();
  if (!data || data > hoje) return { error: "A data do gasto não pode ser futura." };
  const nome = String(item || "").trim();
  if (nome.length < 2) return { error: "Diga o que foi comprado." };
  const qtd = quantidade ? Number(quantidade) : null;
  const descricao = `${nome}${qtd && qtd !== 1 ? ` (${qtd.toLocaleString("pt-BR")} un)` : ""}`.slice(0, 160);
  const conta = await lancarContaPagar(supabase, {
    unidade_id: unidadeId, descricao, valor, data_vencimento: data, competencia: data.slice(0, 7),
    categoria_codigo: categoriaDoTipo(tipo), centro_custo_codigo: "marmitaria", observacao: observacao || null,
  }, { chave, origem_tipo: "MANUAL", pagaEm: data });
  if (conta.error) return { error: conta.error };
  const avisos = [];
  if (conta.erroPagamento) avisos.push(`A conta foi lançada, mas o pagamento não: ${conta.erroPagamento}. Registre o pagamento no Financeiro.`);
  const det = await supabase.from("gastos_detalhe").insert([{
    unidade_id: unidadeId, conta_pagar_id: conta.data.id, data, tipo_gasto: tipo, item: nome.slice(0, 160), quantidade: qtd,
    valor_total: Math.round(Number(valor) * 100) / 100, destino: destino === "colaborador" ? "colaborador" : "geral",
    colaborador_id: destino === "colaborador" ? colaboradorId : null, observacao: observacao || null,
  }]);
  if (det.error && det.error.code !== "23505") {
    avisos.push(ausente(det.error) ? MSG_SEM_GASTOS_1 : `A conta foi lançada, mas o detalhe não: ${det.error.message}`);
  }
  if (naFicha && destino === "colaborador" && tipo === "uniformes_epi" && colaboradorId && !det.error) {
    const ficha = await supabase.from("rh_registros_colab").insert([{
      unidade_id: unidadeId, colaborador_id: colaboradorId, tipo: "uniforme", data, titulo: nome.slice(0, 160), item: nome.slice(0, 160),
      quantidade: qtd, valor_centavos: Math.round(Number(valor) * 100), descricao: observacao || null,
    }]);
    if (ficha.error) avisos.push(`O gasto foi lançado, mas não entrou na ficha do funcionário: ${ausente(ficha.error) ? "a ficha do funcionário ainda não existe neste banco" : ficha.error.message}.`);
  }
  return { error: null, aviso: avisos.join(" ") || null };
}
