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

// Se o banco reclamar de uma coluna ainda não criada (ex: categoria, frete,
// preco_atualizado_em), remove essa coluna do payload e tenta de novo — assim
// o cadastro nunca quebra por falta de migração.
async function retrySemColunaAusente(error, tentar, campos, tentativas = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"? (?:of relation "insumos" )?does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && tentativas < 6) {
    const col = match[1];
    if (col in campos) { delete campos[col]; return retrySemColunaAusente(await tentar(), tentar, campos, tentativas + 1); }
  }
  return error;
}

export async function salvarInsumo(insumo) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // Remove campos que não devem ir no payload: `id` nulo quebra o INSERT
  // (coluna id é NOT NULL com default gen_random_uuid; enviar null viola a constraint)
  // e `created_at` é gerenciado pelo banco.
  const { id, created_at, ...campos } = insumo;

  if (id) {
    // Preço mudou? Grava no histórico e carimba a data da atualização.
    // O histórico nunca pode impedir o salvamento (erro dele é ignorado).
    try {
      const { data: atual } = await supabase.from("insumos")
        .select("custo_unitario, unidade_id, nome").eq("id", id).single();
      const custoAntigo = Number(atual?.custo_unitario) || 0;
      const custoNovo = Number(campos.custo_unitario) || 0;
      if (atual && Math.abs(custoAntigo - custoNovo) > 0.0001) {
        campos.preco_atualizado_em = new Date().toISOString();
        await supabase.from("insumos_precos_historico").insert([{
          unidade_id: campos.unidade_id || atual.unidade_id,
          insumo_id: id,
          insumo_nome: campos.nome || atual.nome,
          custo_anterior: custoAntigo,
          custo_novo: custoNovo,
        }]);
      }
    } catch { /* histórico é acessório */ }
    let { error } = await supabase.from("insumos").update(campos).eq("id", id);
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("insumos").update(campos).eq("id", id); return r.error;
    }, campos);
    return { id, error: error?.message };
  } else {
    campos.preco_atualizado_em = new Date().toISOString();
    let res = await supabase.from("insumos").insert([campos]).select("id").single();
    let data = res.data, error = res.error;
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("insumos").insert([campos]).select("id").single(); data = r.data; return r.error;
    }, campos);
    // Registro inicial de preço no histórico (custo_anterior nulo = cadastro)
    if (data?.id) {
      try {
        await supabase.from("insumos_precos_historico").insert([{
          unidade_id: campos.unidade_id,
          insumo_id: data.id,
          insumo_nome: campos.nome,
          custo_anterior: null,
          custo_novo: Number(campos.custo_unitario) || 0,
        }]);
      } catch { /* histórico é acessório */ }
    }
    return { id: data?.id, error: error?.message };
  }
}

// Histórico de preços dos insumos (todas as alterações, mais recentes primeiro)
export async function fetchHistoricoPrecos(unidadeId, insumoId = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("insumos_precos_historico")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false })
    .limit(400);
  if (insumoId) q = q.eq("insumo_id", insumoId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
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
  
  // Select aninhado: `*` nos ingredientes traz colunas novas (ex: fator_correcao)
  // sem quebrar quando a migração ainda não rodou.
  let query = supabase.from("fichas_tecnicas")
    .select(`
      *,
      fichas_ingredientes!ficha_id(
        *,
        insumos(id, nome, unidade_medida, custo_unitario, peso_medio_g)
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

  // 1. Salva a Capa da Ficha (retry tira colunas ainda não migradas: categoria, ordem)
  if (fichaId) {
    let { error } = await supabase.from("fichas_tecnicas").update(camposFicha).eq("id", fichaId);
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("fichas_tecnicas").update(camposFicha).eq("id", fichaId); return r.error;
    }, camposFicha);
    if(error) return { error: error.message };
  } else {
    let res = await supabase.from("fichas_tecnicas").insert([camposFicha]).select("id").single();
    let error = await retrySemColunaAusente(res.error, async () => {
      const r = await supabase.from("fichas_tecnicas").insert([camposFicha]).select("id").single(); res = r; return r.error;
    }, camposFicha);
    if(error) return { error: error.message };
    fichaId = res.data.id;
  }

  // 2. Apaga ingredientes antigos e insere os novos (forma mais simples)
  await supabase.from("fichas_ingredientes").delete().eq("ficha_id", fichaId);
  
  if (ingredientes && ingredientes.length > 0) {
    const itens = ingredientes.map(i => ({
      ficha_id: fichaId,
      insumo_id: i.insumo_id || null,
      subficha_id: i.subficha_id || null,
      quantidade: i.quantidade,
      fator_correcao: Number(i.fator_correcao) || 0,
    }));
    let { error: errItens } = await supabase.from("fichas_ingredientes").insert(itens);
    // Coluna fator_correcao ainda não migrada? Regrava sem ela (não perde a ficha)
    if (errItens && /fator_correcao/i.test(errItens.message || "")) {
      await supabase.from("fichas_ingredientes").insert(itens.map(({ fator_correcao, ...resto }) => resto));
    }
  }

  return { success: true, id: fichaId };
}

// Atualiza só o custo por unidade de um insumo (usado no "Recalcular custos").
export async function atualizarCustoUnitario(id, custo_unitario) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("insumos").update({ custo_unitario }).eq("id", id);
  return { error: error?.message };
}

export async function removerFicha(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("fichas_tecnicas").delete().eq("id", id);
  return { error: error?.message };
}

// Atualiza só a ordem de exibição (arrastar para reordenar). Se a coluna `ordem`
// ainda não existir, o retry a remove e a operação vira no-op silencioso.
export async function atualizarOrdemFicha(id, ordem) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const campos = { ordem };
  let { error } = await supabase.from("fichas_tecnicas").update(campos).eq("id", id);
  error = await retrySemColunaAusente(error, async () => {
    const r = await supabase.from("fichas_tecnicas").update(campos).eq("id", id); return r.error;
  }, campos);
  return { error: error?.message };
}
