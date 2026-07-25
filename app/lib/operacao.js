import { supabase, isSupabaseReady } from "./supabase";
import { calcularPrecoNormalizado } from "./ingredientes-utils.mjs";

// ─── INSUMOS (Ingredientes Brutos) ──────────────────────────────────────────

export async function fetchInsumos(unidadeId, dept, opcoes = {}) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  let query = supabase.from("insumos").select("*");
  if (unidadeId && (opcoes?.escopoEstrito === true || unidadeId !== "matriz")) query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);

  const { data, error } = await query;
  if (error || !data?.length) return { data: data || [], error: error?.message };

  // A tabela de vínculo foi adicionada depois do cadastro original. Se a
  // migração ainda não tiver sido aplicada, a listagem continua funcionando
  // com o fornecedor textual legado.
  const ids = data.map(item => item.id);
  const { data: vinculos, error: erroVinculos } = await supabase
    .from("insumos_fornecedores")
    .select("insumo_id, fornecedor_id, fornecedor:fornecedores(id,nome)")
    .in("insumo_id", ids);
  if (erroVinculos) return { data, error: null };

  const porInsumo = new Map();
  for (const vinculo of vinculos || []) {
    const fornecedor = Array.isArray(vinculo.fornecedor) ? vinculo.fornecedor[0] : vinculo.fornecedor;
    if (!fornecedor) continue;
    if (!porInsumo.has(vinculo.insumo_id)) porInsumo.set(vinculo.insumo_id, []);
    porInsumo.get(vinculo.insumo_id).push(fornecedor);
  }
  return {
    data: data.map(item => ({
      ...item,
      fornecedores_vinculados: porInsumo.get(item.id) || (item.fornecedor ? [{ nome: item.fornecedor }] : []),
    })),
    error: null,
  };
}

// Se o banco reclamar de uma coluna ainda não criada (ex: categoria, frete,
// preco_atualizado_em), remove essa coluna do payload e tenta de novo — assim
// o cadastro nunca quebra por falta de migração.
async function retrySemColunaAusente(error, tentar, campos, tentativas = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"?(?: of relation "[a-z_]+")? does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && tentativas < 30) {
    const col = match[1];
    if (col in campos) { delete campos[col]; return retrySemColunaAusente(await tentar(), tentar, campos, tentativas + 1); }
  }
  return error;
}

async function inserirHistoricoPreco(registro) {
  const campos = { ...registro };
  let resposta = await supabase.from("insumos_precos_historico").insert([campos]);
  const error = await retrySemColunaAusente(resposta.error, async () => {
    resposta = await supabase.from("insumos_precos_historico").insert([campos]);
    return resposta.error;
  }, campos);
  return error;
}

async function sincronizarFornecedores(insumoId, fornecedorIds = []) {
  if (!insumoId || !Array.isArray(fornecedorIds)) return;
  const ids = [...new Set(fornecedorIds.filter(Boolean))];
  const exclusao = await supabase.from("insumos_fornecedores").delete().eq("insumo_id", insumoId);
  if (exclusao.error || ids.length === 0) return;
  await supabase.from("insumos_fornecedores").insert(ids.map(fornecedor_id => ({
    insumo_id: insumoId,
    fornecedor_id,
  })));
}

function registroHistorico({ atual, campos, insumoId, usuario, origem, inicial = false }) {
  const anterior = atual || {};
  const combinado = { ...anterior, ...campos };
  const valorAnterior = inicial ? null : Number(anterior.custo_compra ?? anterior.custo_unitario) || 0;
  const valorNovo = Number(combinado.custo_compra ?? combinado.custo_unitario) || 0;
  const normalizadoAnterior = inicial ? null : (
    Number(anterior.preco_normalizado)
    || calcularPrecoNormalizado(
      Number(anterior.tamanho_embalagem) || 1,
      anterior.unidade_medida,
      valorAnterior,
    )
  );
  const normalizadoNovo = Number(combinado.preco_normalizado)
    || calcularPrecoNormalizado(
      Number(combinado.tamanho_embalagem) || 1,
      combinado.unidade_medida,
      valorNovo,
    );
  const diferenca = normalizadoAnterior === null ? null : normalizadoNovo - normalizadoAnterior;
  const percentual = normalizadoAnterior > 0 ? (diferenca / normalizadoAnterior) * 100 : null;

  return {
    unidade_id: combinado.unidade_id,
    insumo_id: insumoId,
    insumo_nome: combinado.nome,
    fornecedor_id: combinado.fornecedor_atual_id || null,
    fornecedor_nome: combinado.fornecedor || null,
    embalagem_quantidade_anterior: inicial ? null : Number(anterior.tamanho_embalagem) || 1,
    embalagem_unidade_anterior: inicial ? null : anterior.unidade_medida,
    embalagem_quantidade_nova: Number(combinado.tamanho_embalagem) || 1,
    embalagem_unidade_nova: combinado.unidade_medida,
    valor_anterior: valorAnterior,
    valor_novo: valorNovo,
    preco_normalizado_anterior: normalizadoAnterior,
    preco_normalizado_novo: normalizadoNovo,
    diferenca_valor: diferenca,
    diferenca_percentual: percentual,
    custo_anterior: normalizadoAnterior,
    custo_novo: normalizadoNovo,
    usuario_id: usuario?.id || null,
    usuario_nome: usuario?.user_metadata?.nome || usuario?.email || "Usuário do sistema",
    origem: origem || "Cadastro de ingredientes",
  };
}

export async function salvarInsumo(insumo, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // Remove campos que não devem ir no payload: `id` nulo quebra o INSERT
  // (coluna id é NOT NULL com default gen_random_uuid; enviar null viola a constraint)
  // e `created_at` é gerenciado pelo banco.
  const {
    id,
    created_at,
    updated_at,
    fornecedores_vinculados,
    fornecedor_ids = [],
    ...campos
  } = insumo;
  const fornecedorIds = [...new Set([
    ...fornecedor_ids,
    campos.fornecedor_atual_id,
  ].filter(Boolean))];
  const { data: authData } = await supabase.auth.getUser();
  const usuario = authData?.user || null;

  if (id) {
    // Preço mudou? Grava no histórico e carimba a data da atualização.
    try {
      const { data: atual } = await supabase.from("insumos").select("*").eq("id", id).single();
      const valorAntigo = Number(atual?.custo_compra ?? atual?.custo_unitario) || 0;
      const valorNovo = Number(campos.custo_compra ?? campos.custo_unitario) || 0;
      const embalagemMudou = Number(atual?.tamanho_embalagem || 1) !== Number(campos.tamanho_embalagem ?? atual?.tamanho_embalagem ?? 1)
        || String(atual?.unidade_medida || "") !== String(campos.unidade_medida ?? atual?.unidade_medida ?? "");
      if (atual && (Math.abs(valorAntigo - valorNovo) > 0.0001 || embalagemMudou)) {
        const historico = registroHistorico({
          atual,
          campos,
          insumoId: id,
          usuario,
          origem: opcoes.origem,
        });
        campos.preco_atualizado_em = new Date().toISOString();
        campos.preco_normalizado = historico.preco_normalizado_novo;
        campos.preco_normalizado_anterior = historico.preco_normalizado_anterior;
        campos.variacao_preco_pct = historico.diferenca_percentual;
        await inserirHistoricoPreco(historico);
      }
    } catch { /* histórico é acessório */ }
    let { error } = await supabase.from("insumos").update(campos).eq("id", id);
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("insumos").update(campos).eq("id", id); return r.error;
    }, campos);
    if (!error) await sincronizarFornecedores(id, fornecedorIds);
    return { id, error: error?.message };
  } else {
    const normalizado = Number(campos.preco_normalizado) || calcularPrecoNormalizado(
      Number(campos.tamanho_embalagem) || 1,
      campos.unidade_medida,
      Number(campos.custo_compra ?? campos.custo_unitario) || 0,
    );
    campos.preco_normalizado = normalizado;
    campos.preco_normalizado_anterior = null;
    campos.variacao_preco_pct = null;
    campos.preco_atualizado_em = new Date().toISOString();
    let res = await supabase.from("insumos").insert([campos]).select("id").single();
    let data = res.data, error = res.error;
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("insumos").insert([campos]).select("id").single(); data = r.data; return r.error;
    }, campos);

    // Registro inicial no histórico de preços. O catálogo não cria estoque.
    if (data?.id) {
      try {
        await inserirHistoricoPreco(registroHistorico({
          atual: null,
          campos,
          insumoId: data.id,
          usuario,
          origem: opcoes.origem,
          inicial: true,
        }));
        await sincronizarFornecedores(data.id, fornecedorIds);
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
