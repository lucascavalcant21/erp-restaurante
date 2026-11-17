// Leitura e exclusão dos cardápios dos concorrentes do delivery (CONC-1) pelo
// cliente do usuário: o RLS do banco só devolve o que a permissão
// marmitaria.competitors.view deixa ver, e apagar passa pela função
// hefisto_apagar_leitura_concorrente (marmitaria.competitors.delete).
// Gravar é só pelo Jhon (ação competitor.menu, com prévia e confirmação).

import { supabase, isSupabaseReady } from "../supabase";
import { nossosAdicionaisDaConfig } from "./concorrentes.mjs";

const ausente = (e) => /does not exist|schema cache|PGRST20[25]|could not find/i.test(`${e?.message || ""} ${e?.code || ""}`);
export const MSG_SEM_MIGRACAO = "O banco desta unidade ainda não tem a parte de concorrentes do delivery (migração CONC-1).";

/** Concorrentes e todas as leituras (mais recente primeiro). */
export async function carregarConcorrentes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { concorrentes: [], leituras: [], error: null };
  const [c, l] = await Promise.all([
    supabase.from("delivery_concorrentes").select("id, nome, plataforma, bairro, segmento, link").eq("unidade_id", unidadeId).order("nome"),
    supabase.from("delivery_concorrentes_leituras").select("id, concorrente_id, observado_em, created_at, fonte, taxa_entrega, pedido_minimo, tempo_entrega, avaliacao, qtd_itens")
      .eq("unidade_id", unidadeId).order("observado_em", { ascending: false }).order("created_at", { ascending: false }).limit(500),
  ]);
  const erro = c.error || l.error;
  if (erro) return { concorrentes: [], leituras: [], error: ausente(erro) ? MSG_SEM_MIGRACAO : erro.message, semMigracao: ausente(erro) };
  return { concorrentes: c.data || [], leituras: l.data || [], error: null };
}

export async function carregarItens(unidadeId, leituraId) {
  if (!isSupabaseReady() || !leituraId) return { data: [], error: null };
  const { data, error } = await supabase.from("delivery_concorrentes_itens")
    .select("id, ordem, tipo, categoria, grupo, nome, descricao, componentes, peso_g, serve_pessoas, preco, preco_original")
    .eq("unidade_id", unidadeId).eq("leitura_id", leituraId).order("ordem");
  if (error) return { data: [], error: error.message };
  return { data: (data || []).map((i) => ({ ...i, preco: Number(i.preco), peso_g: i.peso_g != null ? Number(i.peso_g) : null, preco_original: i.preco_original != null ? Number(i.preco_original) : null })), error: null };
}

/** Nossos adicionais: grupos "adicional" do cardápio digital (null = não cadastrados). */
export async function carregarNossosAdicionais(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: null };
  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  if (error) return { data: null, error: error.message };
  return { data: nossosAdicionaisDaConfig(data?.[0]?.params), error: null };
}

export async function apagarLeitura(leituraId) {
  const { data, error } = await supabase.rpc("hefisto_apagar_leitura_concorrente", { p_leitura: leituraId });
  if (error) return { error: ausente(error) ? MSG_SEM_MIGRACAO : error.message };
  if (!data?.ok) return { error: data?.erro || "O banco não confirmou." };
  return { error: null };
}
