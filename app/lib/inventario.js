import { supabase, isSupabaseReady } from "./supabase";

// ─── INVENTÁRIO DA UNIDADE (patrimônio físico) ───────────────────────────────
// Tudo que a loja possui: talheres, louça, potes, panelas, freezers, móveis...
// Cada item tem quantidade; entradas e baixas (quebra/perda/descarte) ficam
// registradas em inventario_movimentos com data e hora.

export const CATEGORIAS_INVENTARIO = [
  "Talheres",
  "Louça e Copos",
  "Potes e Armazenamento",
  "Panelas e Utensílios",
  "Equipamentos",
  "Eletrodomésticos",
  "Móveis",
  "Decoração",
  "Limpeza",
  "Outros",
];

export async function fetchInventario(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("inventario_itens")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("categoria")
    .order("nome");
  return { data: data || [], error: error?.message };
}

// Coluna ainda não migrada (ex: foto)? Remove do payload e tenta de novo,
// para o cadastro nunca quebrar antes do SQL.
async function invRetrySemColuna(error, tentar, campos, n = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"? (?:of relation "inventario_itens" )?does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && n < 6 && match[1] in campos) {
    delete campos[match[1]];
    return invRetrySemColuna(await tentar(), tentar, campos, n + 1);
  }
  return error;
}

export async function salvarItemInventario(item) {
  if (!isSupabaseReady()) return { error: "Offline" };
  // id nulo quebra o INSERT (default gen_random_uuid) — remove antes
  const { id, created_at, updated_at, ...campos } = item;
  if (id) {
    const payload = { ...campos, updated_at: new Date().toISOString() };
    let { error } = await supabase.from("inventario_itens").update(payload).eq("id", id);
    error = await invRetrySemColuna(error, async () => {
      const r = await supabase.from("inventario_itens").update(payload).eq("id", id); return r.error;
    }, payload);
    return { id, error: error?.message };
  }
  let res = await supabase.from("inventario_itens").insert([campos]).select("id").single();
  const error = await invRetrySemColuna(res.error, async () => {
    const r = await supabase.from("inventario_itens").insert([campos]).select("id").single(); res = r; return r.error;
  }, campos);
  return { id: res.data?.id, error: error?.message };
}

export async function removerItemInventario(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("inventario_itens").delete().eq("id", id);
  return { error: error?.message };
}

// Registra um movimento (entrada | quebra | perda | descarte | ajuste) e
// atualiza a quantidade do item. Data/hora ficam no created_at do movimento.
export async function registrarMovimentoInventario(item, { tipo, quantidade, motivo, responsavel }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const qtd = Number(quantidade) || 0;
  if (qtd <= 0) return { error: "Quantidade inválida" };

  const atual = Number(item.quantidade) || 0;
  const novaQtd = tipo === "entrada"
    ? atual + qtd
    : tipo === "ajuste"
      ? qtd // ajuste define a quantidade exata contada
      : Math.max(0, atual - qtd); // quebra/perda/descarte dão baixa

  const { error: errMov } = await supabase.from("inventario_movimentos").insert([{
    unidade_id: item.unidade_id,
    item_id: item.id,
    tipo,
    quantidade: qtd,
    motivo: motivo || null,
    responsavel: responsavel || null,
  }]);
  if (errMov) return { error: errMov.message };

  const { error: errUpd } = await supabase.from("inventario_itens")
    .update({ quantidade: novaQtd, updated_at: new Date().toISOString() })
    .eq("id", item.id);
  return { error: errUpd?.message, novaQtd };
}

export async function fetchMovimentosInventario(unidadeId, limite = 120) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("inventario_movimentos")
    .select("*, inventario_itens(nome, categoria)")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false })
    .limit(limite);
  return { data: data || [], error: error?.message };
}
