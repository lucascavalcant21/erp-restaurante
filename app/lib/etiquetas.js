// ═══════════════════════════════════════════════════════════════
// etiquetas.js — Etiquetas com QR Code + rastreio
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";
import { inserirLancamento } from "./financeiro";

// Presets de conservação (validade padrão em dias) — editável no formulário
export const CONSERVACAO = [
  { id: "Resfriado",  dias: 3,  cor: "#3B82F6" },
  { id: "Congelado",  dias: 30, cor: "#06B6D4" },
  { id: "Ambiente",   dias: 1,  cor: "#F59E0B" },
];

// Gera um código curto e único para o QR/rastreio
export function gerarCodigo() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase();
}

export async function criarEtiqueta(dados, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Sistema indisponível" };
  const { data, error } = await supabase
    .from("etiquetas")
    .insert([carimbarUnidade(dados, unidadeId)])
    .select()
    .single();
  return { data, error: error?.message || null };
}

export async function fetchEtiquetas(unidadeId, limite = 30) {
  if (!isSupabaseReady()) return [];
  let q = supabase.from("etiquetas").select("*").order("created_at", { ascending: false }).limit(limite);
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data } = await q;
  return data || [];
}

// Busca pública por código (usada na página de rastreio ao escanear o QR)
export async function buscarPorCodigo(codigo) {
  if (!isSupabaseReady() || !codigo) return null;
  const { data } = await supabase.from("etiquetas").select("*").eq("codigo", codigo).maybeSingle();
  return data || null;
}

// Status da etiqueta: 'ativa' | 'baixa' (consumido/usado) | 'perda' (perdido/descartado)
export async function atualizarStatusEtiqueta(etiqueta, status) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const id = typeof etiqueta === "string" ? etiqueta : etiqueta.id;
  const { error } = await supabase.from("etiquetas").update({ status }).eq("id", id);
  
  if (!error && typeof etiqueta === "object") {
    // 1. Tentar dar baixa no Estoque Físico buscando o Insumo pelo Nome
    const { data: insumoMatch } = await supabase.from("insumos")
      .select("id")
      .eq("unidade_id", etiqueta.unidade_id)
      .ilike("nome", etiqueta.produto)
      .maybeSingle();

    if (insumoMatch) {
       // Buscar saldo atual
       const { data: estAtual } = await supabase.from("estoque_atual")
          .select("quantidade_atual")
          .eq("unidade_id", etiqueta.unidade_id)
          .eq("insumo_id", insumoMatch.id)
          .maybeSingle();

       const saldoAnterior = estAtual ? estAtual.quantidade_atual : 0;
       const qtdAbater = Number(etiqueta.quantidade) || 0;
       const novoSaldo = Math.max(0, saldoAnterior - qtdAbater);

       await supabase.from("estoque_atual").upsert({
          unidade_id: etiqueta.unidade_id,
          insumo_id: insumoMatch.id,
          quantidade_atual: novoSaldo,
          updated_at: new Date().toISOString()
       }, { onConflict: 'unidade_id, insumo_id' });
    }

    // 2. Se for perda, lançar o prejuízo no DRE (Financeiro)
    if (status === "perda") {
       const valor = (Number(etiqueta.quantidade) || 0) * (Number(etiqueta.custo_unit) || 0);
       if (valor > 0) {
          const hoje = new Date().toISOString().split('T')[0];
          await supabase.from("contas_pagar").insert([{
             unidade_id: etiqueta.unidade_id,
             descricao: `Perda de Validade: ${etiqueta.produto} (${etiqueta.quantidade} ${etiqueta.unidade})`,
             valor: valor,
             data_vencimento: hoje,
             data_pagamento: hoje,
             categoria: 'inventarios',
             status: 'pago' // já entra pago pois o dinheiro já foi gasto lá atrás
          }]);
       }
    }
  }

  return { error: error?.message || null };
}

// Dias até vencer (negativo = já venceu)
export function diasParaVencer(validadeIso) {
  if (!validadeIso) return null;
  return Math.floor((new Date(validadeIso).getTime() - Date.now()) / 86400000);
}
