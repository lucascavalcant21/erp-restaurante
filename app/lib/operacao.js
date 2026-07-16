import { supabase, isSupabaseReady } from "./supabase";

// ─── INSUMOS (Ingredientes Brutos) ──────────────────────────────────────────

export async function fetchInsumos(unidadeId, dept, opcoes = {}) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  let query = supabase.from("insumos").select("*").order("nome");
  if (unidadeId && (opcoes?.escopoEstrito === true || unidadeId !== "matriz")) query = query.eq("unidade_id", unidadeId);
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

export async function fetchFichas(unidadeId, dept, opcoes = {}) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Fazemos um select aninhado para trazer os ingredientes e as infos do insumo
  let query = supabase.from("fichas_tecnicas")
    .select(`
      *,
      fichas_ingredientes!ficha_id(
        id, quantidade, subficha_id,
        insumos(id, nome, unidade_medida, custo_unitario, peso_medio_g)
      )
    `)
    .order("nome_receita");

  if (unidadeId && (opcoes?.escopoEstrito === true || unidadeId !== "matriz")) query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function salvarFicha(ficha, ingredientes, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!Array.isArray(ingredientes)) return { error: "A lista de ingredientes não foi informada." };
  if (ingredientes.length === 0 && opcoes.permitirSemIngredientes !== true) {
    return { error: "A ficha precisa ter pelo menos um ingrediente." };
  }

  const unidadeEsperada = opcoes.unidadeId || ficha.unidade_id;
  if (!unidadeEsperada) return { error: "Unidade da ficha não informada." };

  const gerarUuid = () => globalThis.crypto?.randomUUID?.()
    || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, caractere => {
      const aleatorio = Math.floor(Math.random() * 16);
      return (caractere === "x" ? aleatorio : (aleatorio & 0x3) | 0x8).toString(16);
    });
  const fichaId = ficha.id || gerarUuid();
  const chaves = new Set();
  const itens = [];

  for (const item of ingredientes) {
    const temInsumo = !!item?.insumo_id;
    const temBase = !!item?.subficha_id;
    if (temInsumo === temBase) return { error: "Cada item deve ser um ingrediente ou um pré-preparo." };
    if (!Number.isFinite(Number(item.quantidade)) || Number(item.quantidade) <= 0) {
      return { error: "Todas as quantidades precisam ser maiores que zero." };
    }
    const chave = temInsumo ? `insumo:${item.insumo_id}` : `base:${item.subficha_id}`;
    if (chaves.has(chave)) return { error: "O mesmo ingrediente não pode aparecer duas vezes na ficha." };
    if (temBase && item.subficha_id === fichaId) return { error: "Uma ficha não pode usar a si mesma como pré-preparo." };
    chaves.add(chave);
    itens.push({
      id: item.id || gerarUuid(),
      insumo_id: item.insumo_id || null,
      subficha_id: item.subficha_id || null,
      quantidade: Number(item.quantidade),
    });
  }

  const {
    id: _id,
    created_at: _criadoEm,
    updated_at: _atualizadoEm,
    unidade_id: _unidadeRecebida,
    fichas_ingredientes: _itensRecebidos,
    ...camposFicha
  } = ficha;

  const assinaturaItens = lista => (lista || [])
    .map(item => `${item.insumo_id || ""}:${item.subficha_id || ""}:${Number(item.quantidade).toFixed(8)}`)
    .sort()
    .join("|");
  const valorConfere = (atual, esperado) => {
    if (esperado === null || esperado === undefined || esperado === "") {
      return atual === null || atual === undefined || atual === "";
    }
    if (typeof esperado === "number") return Math.abs(Number(atual) - esperado) < 0.000001;
    if (typeof esperado === "boolean") return Boolean(atual) === esperado;
    return String(atual ?? "") === String(esperado);
  };
  const confirmarGravacao = async () => {
    const [capa, composicao] = await Promise.all([
      supabase.from("fichas_tecnicas").select("*")
        .eq("id", fichaId).eq("unidade_id", unidadeEsperada).maybeSingle(),
      supabase.from("fichas_ingredientes")
        .select("insumo_id, subficha_id, quantidade").eq("ficha_id", fichaId),
    ]);
    if (capa.error || composicao.error || !capa.data) return false;
    const capaConfere = Object.entries(camposFicha).every(([campo, valor]) => valorConfere(capa.data[campo], valor));
    return capaConfere && assinaturaItens(composicao.data) === assinaturaItens(itens);
  };

  const { data, error } = await supabase.rpc("salvar_ficha_tecnica_atomica", {
    p_unidade_id: unidadeEsperada,
    p_ficha_id: fichaId,
    p_ficha: camposFicha,
    p_ingredientes: itens,
    p_permitir_inserir_com_id: opcoes.permitirInserirComId === true,
    p_permitir_sem_ingredientes: opcoes.permitirSemIngredientes === true,
  });

  if (!error) return { success: true, id: data || fichaId };

  const mensagem = error.message || "Não foi possível salvar a ficha.";
  const funcaoPendente = error.code === "PGRST202"
    || /salvar_ficha_tecnica_atomica|schema cache|could not find the function/i.test(mensagem);
  if (funcaoPendente) {
    return { error: "A atualização segura do banco de receitas ainda não foi instalada. Atualize o banco antes de salvar." };
  }

  if (await confirmarGravacao()) return { success: true, id: fichaId, confirmadoAposFalha: true };
  return { error: mensagem, estadoIncerto: !error.code || /fetch|network|conexão|connection/i.test(mensagem) };
}

// Atualiza só o custo por unidade de um insumo (usado no "Recalcular custos").
export async function atualizarCustoUnitario(id, custo_unitario) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("insumos").update({ custo_unitario }).eq("id", id);
  return { error: error?.message };
}

export async function removerFicha(id, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId) return { error: "Unidade da ficha não informada." };
  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .delete()
    .eq("id", id)
    .eq("unidade_id", unidadeId)
    .select("id")
    .maybeSingle();
  if (!error && !data) return { error: "A ficha não existe nesta unidade ou já foi removida." };
  return { error: error?.message };
}

// Salva toda a ordem numa única transação para nunca deixar posições parciais.
export async function atualizarOrdemFichas(idsOrdenados, idsEsperados, unidadeId, departamento) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId) return { error: "Unidade da ficha não informada." };
  if (!Array.isArray(idsOrdenados)) return { error: "A nova ordem não foi informada." };
  if (new Set(idsOrdenados).size !== idsOrdenados.length) return { error: "A nova ordem contém receitas repetidas." };

  const { data, error } = await supabase.rpc("reordenar_fichas_tecnicas", {
    p_unidade_id: unidadeId,
    p_departamento: departamento || null,
    p_ids_esperados: idsEsperados,
    p_ids: idsOrdenados,
  });
  if (!error) return { success: true, atualizadas: Number(data) || 0 };

  const mensagem = error.message || "Não foi possível salvar a nova ordem.";
  const funcaoPendente = error.code === "PGRST202"
    || /reordenar_fichas_tecnicas|schema cache|could not find the function/i.test(mensagem);
  return {
    error: funcaoPendente
      ? "A atualização segura de ordenação ainda não foi instalada no banco."
      : mensagem,
  };
}
