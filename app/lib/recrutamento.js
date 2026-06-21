// ═══════════════════════════════════════════════════════════════
// recrutamento.js — Módulo de Banco de Talentos
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";
import { escoparPorUnidade, carimbarUnidade } from "./unidades";

// Para uso público na página de /vagas
export async function candidatarSe(dados) {
  if (!isSupabaseReady()) return { error: "Sistema temporariamente offline." };
  
  // Lógica de Triagem Automática:
  let status = "Triagem";
  let pontuacao = 0;

  // Se não pode fds/noite, já é reprovado de cara para restaurante
  if (dados.trabalha_fim_semana === false) {
    status = "Reprovado";
  } else {
    // Se aceita fds, pontua
    pontuacao += 50;
    
    // Pontua se mora perto
    if (dados.mora_perto) pontuacao += 30;
    
    // Pontua se tem experiência
    if (dados.exp_anos !== "Não") pontuacao += 20;

    // Se a pontuação for alta, aprova para entrevista
    if (pontuacao >= 80) {
      status = "Aprovado";
    }
  }

  const candidato = {
    ...dados,
    status,
    pontuacao,
    unidade_id: dados.unidade_id || null // Pode se candidatar a uma loja específica ou geral
  };

  const { error } = await supabase.from("candidatos").insert([candidato]);
  return { ok: !error, error: error?.message, status };
}

// Para uso do RH no Dashboard
export async function fetchCandidatos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  let query = supabase.from("candidatos").select("*").order("created_at", { ascending: false });
  query = escoparPorUnidade(query, unidadeId);
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function atualizarStatusCandidato(id, novoStatus) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("candidatos").update({ status: novoStatus }).eq("id", id);
  return { error: error?.message };
}

export async function removerCandidato(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("candidatos").delete().eq("id", id);
  return { error: error?.message };
}
