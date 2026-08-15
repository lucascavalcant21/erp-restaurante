// ═══════════════════════════════════════════════════════════════
// etiquetas.js — Etiquetas com QR Code + rastreio
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";
import { inserirLancamento } from "./financeiro";
import { entradaPorEtiqueta, saidaPorEtiqueta } from "./etiqueta-estoque";

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

const COLUNAS_OPCIONAIS_ETIQUETA = new Set(["copias", "tipo_etiqueta"]);

// Coluna opcional ainda não migrada? Remove do payload e tenta de novo.
// Campos essenciais nunca são descartados silenciosamente.
async function etqRetrySemColuna(error, tentar, campos, n = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"? (?:of relation "etiquetas" )?does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && n < COLUNAS_OPCIONAIS_ETIQUETA.size
    && COLUNAS_OPCIONAIS_ETIQUETA.has(match[1]) && match[1] in campos) {
    delete campos[match[1]];
    return etqRetrySemColuna(await tentar(), tentar, campos, n + 1);
  }
  return error;
}

export async function criarEtiqueta(dados, unidadeId, { departamento = "", usuario = null } = {}) {
  if (!isSupabaseReady()) return { data: null, error: "Sistema indisponível" };
  const payload = carimbarUnidade(dados, unidadeId);
  let res = await supabase.from("etiquetas").insert([payload]).select().single();
  const error = await etqRetrySemColuna(res.error, async () => {
    const r = await supabase.from("etiquetas").insert([payload]).select().single(); res = r; return r.error;
  }, payload);
  if (error) return { data: res.data, error: error.message || null };

  // Etiqueta gerada (impressa) declara produção: a quantidade entra no estoque.
  // Só "salva" ainda não é produção, então não movimenta nada.
  let estoque = null;
  if (dados.status === "ativa") {
    estoque = await entradaPorEtiqueta({
      unidadeId,
      etiqueta: { ...payload, ...(res.data || {}), departamento },
      usuario,
    });
  }
  return { data: res.data, error: null, estoque };
}

export async function fetchEtiquetas(unidadeId, limite = 30, status) {
  if (!isSupabaseReady()) return [];
  let q = supabase.from("etiquetas").select("*").order("created_at", { ascending: false }).limit(limite);
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return data || [];
}

// Promove uma etiqueta SALVA para GERADA (status 'ativa') — sem baixar estoque.
export async function gerarEtiquetaSalva(id) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const { error } = await supabase.from("etiquetas").update({ status: "ativa" }).eq("id", id);
  return { error: error?.message || null };
}

// Exclui de vez uma etiqueta (usado na lista de salvas).
export async function excluirEtiqueta(id) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const { error } = await supabase.from("etiquetas").delete().eq("id", id);
  return { error: error?.message || null };
}

export async function salvarListaEtiquetas(dados, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Sistema indisponível" };
  const payload = carimbarUnidade({
    nome: dados.nome,
    setor: dados.setor,
    responsavel_id: dados.responsavelId || null,
    responsavel_nome: dados.responsavelNome || null,
    itens: dados.itens || [],
    total_etiquetas: Number(dados.totalEtiquetas) || 0,
    criado_por: dados.criadoPor || null,
  }, unidadeId);
  const { data, error } = await supabase.from("listas_etiquetas").insert(payload).select().single();
  return { data, error: error?.message || null };
}

export async function fetchListasEtiquetas(unidadeId, setor, limite = 30) {
  if (!isSupabaseReady()) return { data: [], error: "Sistema indisponível" };
  let consulta = supabase.from("listas_etiquetas").select("*").order("created_at", { ascending: false }).limit(limite);
  if (unidadeId && unidadeId !== "todas") consulta = consulta.eq("unidade_id", unidadeId);
  if (setor) consulta = consulta.eq("setor", setor);
  const { data, error } = await consulta;
  return { data: data || [], error: error?.message || null };
}

export async function excluirListaEtiquetas(id) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const { error } = await supabase.from("listas_etiquetas").delete().eq("id", id);
  return { error: error?.message || null };
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
    // 1. Saída no estoque em que a etiqueta entrou, com histórico auditável.
    //    (Antes o saldo era sobrescrito direto em estoque_atual, sem registro.)
    await saidaPorEtiqueta({
      unidadeId: etiqueta.unidade_id,
      etiqueta,
      motivo: status === "perda" ? "perda" : "baixa",
    }).catch(() => {});

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
