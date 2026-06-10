// ═══════════════════════════════════════════════════════════════
// etiquetas.js — Etiquetas com QR Code + rastreio
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";

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
export async function atualizarStatusEtiqueta(id, status) {
  if (!isSupabaseReady()) return { error: "Sistema indisponível" };
  const { error } = await supabase.from("etiquetas").update({ status }).eq("id", id);
  return { error: error?.message || null };
}

// Dias até vencer (negativo = já venceu)
export function diasParaVencer(validadeIso) {
  if (!validadeIso) return null;
  return Math.floor((new Date(validadeIso).getTime() - Date.now()) / 86400000);
}
