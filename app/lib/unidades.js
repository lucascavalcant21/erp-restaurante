// ═══════════════════════════════════════════════════════════════
// unidades.js — Restaurantes (Unidades)
// ═══════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from "./supabase";

// Unidade de demonstração: só existe quando NÃO há Supabase configurado, para
// a tela abrir em desenvolvimento. Ela é marcada, e nada que grava aceita uma
// unidade marcada assim.
const UNIDADE_DEMO = { id: "matriz", nome: "Unidade Matriz", cor: "#22c55e", demo: true };

export async function fetchUnidades() {
  // Sem Supabase nada é gravado, então a unidade de demonstração não faz mal.
  if (!isSupabaseReady()) return { data: [UNIDADE_DEMO], error: null };

  const { data, error } = await supabase.from("unidades").select("*").order("nome");

  // Antes, erro de leitura OU tabela vazia devolviam a unidade "matriz" como se
  // fosse real. O app inteiro passava a operar nela — e "matriz" nunca foi uma
  // linha de `unidades`: é o curinga que as consultas usam para dizer "não
  // filtre por unidade". Na hora de salvar, a chave estrangeira recusava
  // ("violates foreign key constraint fichas_tecnicas_unidade_id_fkey"), e onde
  // não há chave estrangeira era pior: gravava numa unidade inexistente sem
  // erro nenhum.
  //
  // Agora a falha aparece como falha. Sem unidade, as telas pedem para escolher
  // uma — que é a verdade — em vez de deixar o usuário gravar no vazio.
  if (error) {
    const m = error.message || "";
    return {
      data: [],
      error: /row-level security|violates row-level|permission denied|policy/i.test(m)
        ? "Sem permissão para ler as unidades (política RLS na tabela `unidades`)."
        : m,
    };
  }
  return { data: data || [], error: null };
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
  // Lista vazia NÃO vira "matriz". "matriz" é um curinga de leitura ("não
  // filtre por unidade") e nunca foi uma linha da tabela `unidades` — gravar
  // com ele estoura a chave estrangeira ("violates foreign key constraint
  // fichas_tecnicas_unidade_id_fkey") ou, pior, arquiva o registro numa
  // unidade que não existe, sem erro nenhum.
  //
  // Uma falha passageira ao carregar as unidades trocava o app inteiro por
  // essa unidade fantasma e só aparecia na hora de salvar. Sem id, as telas
  // já pedem para escolher a unidade, que é a verdade.
  if (listaUnidades.length === 0) return "";
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
