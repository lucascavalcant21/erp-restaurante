// ═══════════════════════════════════════════════════════════════
// delivery.js — Configurações do delivery e motoboys (painel)
// ═══════════════════════════════════════════════════════════════
// O cardápio do cliente agora é o cardápio digital (/cardapio/[unidade]).
// Daqui saíram o catálogo de demonstração, o PIX "copia e cola" falso, a taxa
// sorteada e os "pontos de fogo" sem regra do delivery antigo (B-030).

import { supabase, isSupabaseReady } from "./supabase";

// ─── Configurações de Delivery ──────────────────────────────
export async function fetchDeliveryConfigs(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase
    .from("delivery_configs")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function salvarDeliveryConfigs(unidadeId, configs) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const { data: existe } = await supabase
    .from("delivery_configs")
    .select("id")
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  const payload = {
    unidade_id: unidadeId,
    raio_km: configs.raio_km,
    taxa_base: configs.taxa_base,
    taxa_por_km: configs.taxa_por_km,
    tempo_min: configs.tempo_min,
    tempo_max: configs.tempo_max,
    status_loja: configs.status_loja || "aberto",
  };

  if (existe) {
    const { error } = await supabase.from("delivery_configs").update(payload).eq("id", existe.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("delivery_configs").insert([payload]);
    return { error: error?.message };
  }
}

export async function fetchMotoboys(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase
    .from("motoboys")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("nome");
  return { data: data || [], error: error?.message };
}

export async function salvarMotoboy(unidadeId, motoboy) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    nome: motoboy.nome,
    telefone: motoboy.telefone,
    placa: motoboy.placa,
    status: motoboy.status || "offline",
  };

  if (motoboy.id && typeof motoboy.id === "string" && motoboy.id.length > 10) {
    const { error } = await supabase.from("motoboys").update(payload).eq("id", motoboy.id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("motoboys").insert([payload]);
    return { error: error?.message };
  }
}

export async function removerMotoboy(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("motoboys").delete().eq("id", id);
  return { error: error?.message };
}
