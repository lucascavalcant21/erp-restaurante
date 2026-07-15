// ═══════════════════════════════════════════════════════════════
// unidades.js — Restaurantes (Unidades)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

export async function fetchUnidades() {
  if (!isSupabaseReady()) {
    // Retorno fallback se não tiver supabase
    return { data: [{ id: "matriz", nome: "Unidade Matriz", cor: "#22c55e" }], error: null };
  }
  const { data, error } = await supabase.from("unidades").select("*").order("nome");
  if (error || !data || data.length === 0) {
    return { data: [{ id: "matriz", nome: "Unidade Matriz", cor: "#22c55e" }], error: null };
  }
  return { data, error: null };
}

export async function inserirUnidade(u) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("unidades").insert([u]).select().single();
  if (error) {
    const m = error.message || "";
    if (/row-level security|violates row-level|permission denied|policy/i.test(m)) {
      return { data: null, error: "Sem permissão para criar unidades (política RLS). Rode o SQL das políticas da tabela unidades que te passei no chat." };
    }
    return { data: null, error: m };
  }
  return { data, error: null };
}

export async function atualizarUnidade(id, updates) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("unidades").update(updates).eq("id", id);
  return { error: error?.message };
}

// Exclui a unidade E todos os dados vinculados a ela. Sem isso, os vínculos
// (chaves estrangeiras) impedem a exclusão — inclusive das unidades de teste.
export async function removerUnidade(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!id) return { error: "Unidade inválida." };
  try {
    // 1) Sub-filhos que dependem de "pais" da unidade (referenciam por id do pai,
    //    não por unidade_id) — precisam ser apagados antes.
    const limparSubfilhos = async () => {
      const { data: fichas } = await supabase.from("fichas_tecnicas").select("id").eq("unidade_id", id);
      if (fichas?.length) await supabase.from("fichas_ingredientes").delete().in("ficha_id", fichas.map(f => f.id));
      const { data: pedidos } = await supabase.from("pedidos").select("id").eq("unidade_id", id);
      if (pedidos?.length) await supabase.from("pedidos_itens").delete().in("pedido_id", pedidos.map(p => p.id));
      const { data: tpls } = await supabase.from("checklists_templates").select("id").eq("unidade_id", id);
      if (tpls?.length) await supabase.from("checklists_execucoes").delete().in("template_id", tpls.map(t => t.id));
    };
    await limparSubfilhos();

    // 2) Loop dinâmico: tenta apagar a unidade; se travar por vínculo (FK), lê a
    //    tabela citada no próprio erro e apaga as linhas dela dessa unidade —
    //    assim cobre QUALQUER tabela sem precisar listar uma por uma.
    const tabelasTratadas = new Set();
    for (let i = 0; i < 60; i++) {
      const { error } = await supabase.from("unidades").delete().eq("id", id);
      if (!error) return { error: null };
      const tabela = (error.message || "").match(/on table "([a-z0-9_]+)"/i)?.[1];
      if (!tabela || tabela === "unidades") return { error: error.message };
      const { error: eDel } = await supabase.from(tabela).delete().eq("unidade_id", id);
      if (eDel) {
        // A tabela filha tem seus próprios vínculos: apaga a citada e segue.
        const filha = (eDel.message || "").match(/on table "([a-z0-9_]+)"/i)?.[1];
        if (filha && filha !== tabela) await supabase.from(filha).delete().eq("unidade_id", id);
        else if (tabelasTratadas.has(tabela)) return { error: `Não consegui apagar os dados de "${tabela}". Rode o SQL de CASCADE que te passei.` };
      }
      tabelasTratadas.add(tabela);
      await limparSubfilhos();
    }
    return { error: "Muitas dependências. Rode o SQL de CASCADE que te passei para excluir de vez." };
  } catch (e) {
    return { error: e?.message || "Falha ao excluir a unidade." };
  }
}

export const DEPARTAMENTOS = [
  { id: "bar",      nome: "Bar e Bebidas",       cor: "#3B82F6" },
  { id: "cozinha",  nome: "Cozinha e Pratos",    cor: "#10B981" },
];

/** Retorna a unidade pelo id. Se não achar, retorna a primeira da lista. */
export function getUnidade(listaUnidades, id) {
  if (!listaUnidades || listaUnidades.length === 0) return { id: "matriz", nome: "Unidade Matriz", cor: "#22c55e" };
  return listaUnidades.find((u) => u.id === id) || listaUnidades[0];
}

/**
 * Resolve a unidade inicial a partir da sessão.
 */
export function unidadeDaSessao(sessao, listaUnidades = []) {
  if (listaUnidades.length === 0) return "matriz";
  const v = sessao?.unidade;
  if (!v) return listaUnidades[0].id;
  const porId = listaUnidades.find((u) => u.id === v);
  if (porId) return porId.id;
  return listaUnidades[0].id;
}

/** Papéis que enxergam a rede inteira e podem gerenciar lojas. */
export function podeVerTodas(papelId) {
  return papelId === "admin" || papelId === "financeiro";
}

/** Aplica .eq("unidade_id", ...) na query. (Obrigatório ter unidade) */
export function escoparPorUnidade(query, unidadeId) {
  return unidadeId ? query.eq("unidade_id", unidadeId) : query;
}

/** Carimba unidade_id num objeto a inserir. */
export function carimbarUnidade(obj, unidadeId) {
  return { ...obj, unidade_id: unidadeId };
}
