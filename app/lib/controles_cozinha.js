import { supabase, isSupabaseReady } from "./supabase";

// ─── LIMPEZA ─────────────────────────────────────────────────────────────────

export async function fetchControleLimpeza(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("controle_limpeza")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function inserirControleLimpeza(obj) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data, error } = await supabase.from("controle_limpeza").insert([obj]).select().single();
  return { data, error: error?.message };
}

// Permite completar o ciclo aos poucos: primeiro a chegada do produto, depois
// o início do uso e, por último, o fim. Mantemos tudo no mesmo registro para o
// histórico não virar três linhas soltas sem relação entre si.
export async function atualizarControleLimpeza(id, campos) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!id) return { error: "Registro inválido." };
  const permitidos = {};
  for (const chave of ["produto", "volume", "inicio_uso", "fim_uso", "created_at"]) {
    if (Object.prototype.hasOwnProperty.call(campos || {}, chave)) permitidos[chave] = campos[chave] || null;
  }
  const { data, error } = await supabase.from("controle_limpeza").update(permitidos).eq("id", id).select().single();
  return { data, error: error?.message };
}

export async function finalizarControleLimpeza(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_limpeza").update({ fim_uso: new Date().toISOString() }).eq("id", id);
  return { error: error?.message };
}

export async function excluirControleLimpeza(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_limpeza").delete().eq("id", id);
  return { error: error?.message };
}


// ─── GÁS ─────────────────────────────────────────────────────────────────────

export async function fetchControleGas(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("controle_gas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function inserirControleGas(obj) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data, error } = await supabase.from("controle_gas").insert([obj]).select().single();
  return { data, error: error?.message };
}

export async function finalizarControleGas(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_gas").update({ fim_uso: new Date().toISOString() }).eq("id", id);
  return { error: error?.message };
}

export async function excluirControleGas(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_gas").delete().eq("id", id);
  return { error: error?.message };
}


// ─── ÓLEO ────────────────────────────────────────────────────────────────────

export async function fetchControleOleo(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("controle_oleo")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function inserirControleOleo(obj) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data, error } = await supabase.from("controle_oleo").insert([obj]).select().single();
  return { data, error: error?.message };
}

export async function registrarFiltragemOleo(id, arrayAtual, novaData) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const n = [...(arrayAtual || []), novaData];
  const { error } = await supabase.from("controle_oleo").update({ filtragens: n }).eq("id", id);
  return { error: error?.message, filtragens: n };
}

export async function finalizarControleOleo(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_oleo").update({ fim_uso: new Date().toISOString() }).eq("id", id);
  return { error: error?.message };
}

export async function excluirControleOleo(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_oleo").delete().eq("id", id);
  return { error: error?.message };
}


// ─── LIMPEZAS PROGRAMADAS / AGENDA ───────────────────────────────────────────
// Limpezas periódicas: coifa, filtros do ar-condicionado, caixa d'água,
// dedetização etc. Cada uma tem uma frequência (em dias) e a data da próxima.

// Presets sugeridos ao criar uma nova limpeza programada.
export const PRESETS_MANUTENCAO = [
  { nome: "Limpeza da Coifa",              categoria: "coifa",           frequencia_dias: 30 },
  { nome: "Filtros do Ar-Condicionado",    categoria: "ar_condicionado", frequencia_dias: 30 },
  { nome: "Limpeza da Caixa d'Água",       categoria: "outro",           frequencia_dias: 180 },
  { nome: "Dedetização",                   categoria: "outro",           frequencia_dias: 90 },
  { nome: "Limpeza da Câmara Fria",        categoria: "outro",           frequencia_dias: 15 },
  { nome: "Higienização de Reservatórios", categoria: "outro",           frequencia_dias: 180 },
];

// Calcula a próxima data (YYYY-MM-DD) a partir de uma base + dias.
export function calcularProximaData(baseISO, dias) {
  const base = baseISO ? new Date(baseISO) : new Date();
  const prox = new Date(base.getTime() + (Number(dias) || 0) * 86400000);
  return prox.toISOString().split("T")[0];
}

export async function fetchManutencoes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("controle_manutencoes")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("proxima_prevista", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function inserirManutencao(obj) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = {
    ...obj,
    proxima_prevista: obj.proxima_prevista || calcularProximaData(obj.ultima_execucao, obj.frequencia_dias),
    historico: obj.historico || [],
  };
  const { data, error } = await supabase.from("controle_manutencoes").insert([payload]).select().single();
  return { data, error: error?.message };
}

export async function atualizarManutencao(id, patch) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_manutencoes").update(patch).eq("id", id);
  return { error: error?.message };
}

// Registra que a limpeza foi feita agora: guarda no histórico, atualiza a
// última execução e recalcula a próxima data pela frequência.
export async function registrarExecucaoManutencao(item, execucao) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const agoraISO = execucao?.data || new Date().toISOString();
  const historico = [
    { data: agoraISO, responsavel: execucao?.responsavel || "", observacao: execucao?.observacao || "" },
    ...(item.historico || []),
  ];
  const { error } = await supabase.from("controle_manutencoes").update({
    ultima_execucao: agoraISO,
    proxima_prevista: calcularProximaData(agoraISO, item.frequencia_dias),
    historico,
  }).eq("id", item.id);
  return { error: error?.message };
}

export async function excluirManutencao(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("controle_manutencoes").delete().eq("id", id);
  return { error: error?.message };
}
