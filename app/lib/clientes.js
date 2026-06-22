/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Clientes (CRM, NPS, Campanhas)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

// ── Seeds (Fallback caso a tabela não exista) ─────────────────────────────────
export const CLIENTES_SEED = [
  { id: "1", nome: "Fernando Costa", telefone: "(11) 9988-7766", unidade: "todas", total_gasto: 3450.00, total_pedidos: 14, ultima_compra: "2026-06-21", status: "Vip" },
  { id: "2", nome: "Mariana Souza", telefone: "(11) 9777-6655", unidade: "todas", total_gasto: 1280.50, total_pedidos: 5, ultima_compra: "2026-06-19", status: "Frequente" },
  { id: "3", nome: "Roberto Almeida", telefone: "(11) 9666-5544", unidade: "todas", total_gasto: 150.00, total_pedidos: 1, ultima_compra: "2026-06-15", status: "Risco" },
  { id: "4", nome: "Camila Dias", telefone: "(11) 9555-4433", unidade: "todas", total_gasto: 890.00, total_pedidos: 3, ultima_compra: "2026-06-07", status: "Frequente" },
  { id: "5", nome: "Thiago Mendes", telefone: "(11) 9444-3322", unidade: "todas", total_gasto: 4500.00, total_pedidos: 22, ultima_compra: "2026-06-22", status: "Vip" },
];

export const AVALIACOES_SEED = [
  { id: "1", cliente_id: "2", nome: "Mariana Souza", nota: 5, origem: "Google", data: "2026-06-21", comentario: "Comida excelente, mas o garçom demorou um pouco." },
  { id: "2", cliente_id: "3", nome: "Roberto Almeida", nota: 2, origem: "iFood", data: "2026-06-15", comentario: "O prato chegou frio." },
  { id: "3", cliente_id: "5", nome: "Thiago Mendes", nota: 5, origem: "Tablet Mesa", data: "2026-06-22", comentario: "Melhor restaurante!" },
];

export const CAMPANHAS_SEED = [
  { id: "1", nome: "Resgate de Clientes em Risco", tipo: "SMS", descricao: "Cupom 20% para quem não vem há 30 dias", cupom: "VOLTA20", status: "Ativa", clientes_atingidos: 145, receita_gerada: 1200.00 },
];

// ── Clientes ──────────────────────────────────────────────────────────────────
export async function fetchClientes(unidadeId) {
  if (!isSupabaseReady()) return { data: CLIENTES_SEED, error: null, fromSeed: true };
  const { data, error } = await escoparPorUnidade(
    supabase.from("clientes").select("*").order("total_gasto", { ascending: false }),
    unidadeId,
  );
  if (error || !data) return { data: CLIENTES_SEED, error: null, fromSeed: true };
  
  // Adiciona a tag "status" dinamicamente
  const enriquecidos = data.map(c => {
    let s = "Novo";
    if (c.total_gasto > 2000) s = "Vip";
    else if (c.total_pedidos >= 3) s = "Frequente";
    
    // Simplificando o risco por data (mock logico se nao tiver)
    const diff = c.ultima_compra ? Math.floor((Date.now() - new Date(c.ultima_compra).getTime())/86400000) : 0;
    if (diff > 30) s = "Risco";
    
    return { ...c, status: s };
  });
  
  return { data: enriquecidos.length > 0 ? enriquecidos : CLIENTES_SEED, error: null, fromSeed: false };
}

export async function inserirCliente(cliente, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("clientes").insert([carimbarUnidade(cliente, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarCliente(id, updates) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("clientes").update(updates).eq("id", id);
  return { error: error?.message || null };
}

// ── NPS ───────────────────────────────────────────────────────────────────────
export async function fetchAvaliacoes(unidadeId) {
  if (!isSupabaseReady()) return { data: AVALIACOES_SEED, error: null, fromSeed: true };
  const { data, error } = await escoparPorUnidade(
    supabase.from("avaliacoes_nps").select("*").order("data", { ascending: false }),
    unidadeId,
  );
  if (error || !data || data.length === 0) return { data: AVALIACOES_SEED, error: null, fromSeed: true };
  return { data, error: null, fromSeed: false };
}

export async function inserirAvaliacao(avaliacao, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("avaliacoes_nps").insert([carimbarUnidade(avaliacao, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

// ── Campanhas ─────────────────────────────────────────────────────────────────
export async function fetchCampanhas(unidadeId) {
  if (!isSupabaseReady()) return { data: CAMPANHAS_SEED, error: null, fromSeed: true };
  const { data, error } = await escoparPorUnidade(
    supabase.from("campanhas").select("*").order("created_at", { ascending: false }),
    unidadeId,
  );
  if (error || !data || data.length === 0) return { data: CAMPANHAS_SEED, error: null, fromSeed: true };
  return { data, error: null, fromSeed: false };
}

export async function inserirCampanha(campanha, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase não configurado" };
  const { data, error } = await supabase.from("campanhas").insert([carimbarUnidade(campanha, unidadeId)]).select().single();
  return { data, error: error?.message || null };
}

export async function atualizarStatusCampanha(id, status) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };
  const { error } = await supabase.from("campanhas").update({ status }).eq("id", id);
  return { error: error?.message || null };
}
