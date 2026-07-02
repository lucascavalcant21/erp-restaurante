import { supabase, isSupabaseReady } from "./supabase";

// ─── INSUMOS (Ingredientes Brutos) ──────────────────────────────────────────

export async function fetchInsumos(unidadeId, dept) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  let query = supabase.from("insumos").select("*").order("nome");
  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function salvarInsumo(insumo) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // Remove campos que não devem ir no payload: `id` nulo quebra o INSERT
  // (coluna id é NOT NULL com default gen_random_uuid; enviar null viola a constraint)
  // e `created_at` é gerenciado pelo banco.
  const { id, created_at, ...campos } = insumo;

  if (id) {
    const { error } = await supabase.from("insumos").update(campos).eq("id", id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("insumos").insert([campos]);
    return { error: error?.message };
  }
}

export async function removerInsumo(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  // Isso falhará se o insumo estiver numa ficha (graças ao ON DELETE RESTRICT)
  // O que é ótimo, pois evita quebrar o custo das receitas.
  const { error } = await supabase.from("insumos").delete().eq("id", id);
  return { error: error?.message };
}

// ─── FICHAS TÉCNICAS (Receitas) ──────────────────────────────────────────────

export async function fetchFichas(unidadeId, dept) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Fazemos um select aninhado para trazer os ingredientes e as infos do insumo
  let query = supabase.from("fichas_tecnicas")
    .select(`
      *,
      fichas_ingredientes(
        id, quantidade, subficha_id,
        insumos(id, nome, unidade_medida, custo_unitario)
      )
    `)
    .order("nome_receita");

  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function salvarFicha(ficha, ingredientes) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  let fichaId = ficha.id;
  // `id` nulo quebra o INSERT (mesma constraint NOT NULL da tabela insumos)
  const { id: _id, created_at, ...camposFicha } = ficha;

  // 1. Salva a Capa da Ficha
  if (fichaId) {
    const { error } = await supabase.from("fichas_tecnicas").update(camposFicha).eq("id", fichaId);
    if(error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("fichas_tecnicas").insert([camposFicha]).select("id").single();
    if(error) return { error: error.message };
    fichaId = data.id;
  }

  // 2. Apaga ingredientes antigos e insere os novos (forma mais simples)
  await supabase.from("fichas_ingredientes").delete().eq("ficha_id", fichaId);
  
  if (ingredientes && ingredientes.length > 0) {
    const itens = ingredientes.map(i => ({
      ficha_id: fichaId,
      insumo_id: i.insumo_id || null,
      subficha_id: i.subficha_id || null,
      quantidade: i.quantidade
    }));
    await supabase.from("fichas_ingredientes").insert(itens);
  }

  return { success: true };
}

export async function removerFicha(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("fichas_tecnicas").delete().eq("id", id);
  return { error: error?.message };
}
