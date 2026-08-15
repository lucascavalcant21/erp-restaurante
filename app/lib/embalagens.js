import { supabase } from "./supabase";
import { garantirEstoquesPadrao } from "./estoques-multiplos";

export async function sincronizarEmbalagemNoEstoque(unidadeId, embalagem) {
  if (!embalagem?.id || !embalagem?.nome) return;
  const departamento = embalagem.departamento === "bar" ? "bar" : "cozinha";
  await garantirEstoquesPadrao(unidadeId);

  let insumoId = embalagem.insumo_id || null;
  if (!insumoId) {
    const existente = await supabase.from("insumos").select("id").eq("unidade_id", unidadeId).eq("departamento", "embalagens").eq("nome", embalagem.nome).limit(1).maybeSingle();
    insumoId = existente.data?.id || null;
  }
  if (!insumoId) {
    const criado = await supabase.from("insumos").insert([{
      unidade_id: unidadeId,
      nome: embalagem.nome,
      departamento: "embalagens",
      categoria: embalagem.categoria || "Embalagens",
      unidade_medida: "un",
      unidade_comercial: "un",
      tamanho_embalagem: 1,
      custo_unitario: Number(embalagem.preco_unitario) || 0,
      custo_compra: Number(embalagem.preco_unitario) || 0,
    }]).select("id").single();
    insumoId = criado.data?.id || null;
  }
  if (!insumoId) return;

  await supabase.from("operacao_embalagens").update({ insumo_id: insumoId }).eq("id", embalagem.id).eq("unidade_id", unidadeId);
  await supabase.from("insumos").update({
    custo_unitario: Number(embalagem.preco_unitario) || 0,
    custo_compra: Number(embalagem.preco_unitario) || 0,
  }).eq("id", insumoId);

  const { data: estoque } = await supabase.from("estoques").select("id").eq("unidade_id", unidadeId).eq("slug", `embalagens-${departamento}`).maybeSingle();
  if (!estoque?.id) return;
  await supabase.from("estoque_itens").upsert({
    unidade_id: unidadeId,
    estoque_id: estoque.id,
    insumo_id: insumoId,
    quantidade_atual: Number(embalagem.quantidade_atual) || 0,
    estoque_minimo: Number(embalagem.quantidade_minima) || 0,
    custo_unitario: Number(embalagem.preco_unitario) || 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "estoque_id,insumo_id" });
}

export async function fetchEmbalagens(unidadeId, departamento = "") {
  if (!unidadeId) return { data: [], error: 'Sem unidade' };
  let query = supabase
    .from('operacao_embalagens')
    .select('*')
    .eq('unidade_id', unidadeId);
  if (departamento) query = query.eq('departamento', departamento);
  const { data, error } = await query.order('nome', { ascending: true });
  return { data, error };
}

export async function salvarEmbalagem(unidadeId, payload) {
  let resultado;
  if (payload.id) {
    const { id, ...updateData } = payload;
    resultado = await supabase
      .from('operacao_embalagens')
      .update(updateData)
      .eq('id', id)
      .eq('unidade_id', unidadeId)
      .select()
      .single();
  } else {
    resultado = await supabase
      .from('operacao_embalagens')
      .insert({ ...payload, unidade_id: unidadeId })
      .select()
      .single();
  }
  if (!resultado.error && resultado.data) await sincronizarEmbalagemNoEstoque(unidadeId, resultado.data).catch(() => {});
  return { data: resultado.data, error: resultado.error };
}

export async function apagarEmbalagem(unidadeId, id) {
  const { error } = await supabase
    .from('operacao_embalagens')
    .delete()
    .eq('id', id)
    .eq('unidade_id', unidadeId);
  return { error };
}

export async function registrarConsumoEmbalagem(unidadeId, payload) {
  // payload: { funcionario_id, embalagem_id, quantidade, tipo_movimento }
  const { data, error } = await supabase
    .from('operacao_embalagens_consumo')
    .insert({ ...payload, unidade_id: unidadeId })
    .select()
    .single();

  if (!error && payload.embalagem_id && payload.quantidade) {
    // Reduz do estoque
    const { data: estAtual } = await supabase
      .from('operacao_embalagens')
      .select('*, insumo_id')
      .eq('id', payload.embalagem_id)
      .single();
      
    if (estAtual) {
      const quantidadeAtualizada = Number(estAtual.quantidade_atual) - Number(payload.quantidade);
      await supabase
        .from('operacao_embalagens')
        .update({ quantidade_atual: quantidadeAtualizada })
        .eq('id', payload.embalagem_id);
      await sincronizarEmbalagemNoEstoque(unidadeId, { ...estAtual, id: payload.embalagem_id, quantidade_atual: quantidadeAtualizada }).catch(() => {});
    }
  }

  return { data, error };
}

export async function fetchConsumoPorEmbalagem(unidadeId, embalagemId) {
  const { data, error } = await supabase
    .from('operacao_embalagens_consumo')
    .select(`
      *,
      colaboradores:funcionario_id (nome)
    `)
    .eq('unidade_id', unidadeId)
    .eq('embalagem_id', embalagemId)
    .order('data_registro', { ascending: false })
    .limit(50);
  return { data, error };
}

export async function fetchListaComprasEmbalagens(unidadeId, departamento = "") {
  let query = supabase
    .from('operacao_embalagens')
    .select('*')
    .eq('unidade_id', unidadeId);
  if (departamento) query = query.eq('departamento', departamento);
  const { data, error } = await query;
    
  if (error) return { data: [], error };
  
  const lista = data.filter(e => Number(e.quantidade_atual) <= Number(e.quantidade_minima));
  return { data: lista, error: null };
}

export async function fetchHistoricoConsumoEmbalagens(unidadeId, departamento = "") {
  const { data, error } = await supabase
    .from('operacao_embalagens_consumo')
    .select(`
      *,
      colaboradores:funcionario_id (nome),
      operacao_embalagens:embalagem_id (nome, departamento)
    `)
    .eq('unidade_id', unidadeId)
    .order('data_registro', { ascending: false })
    .limit(100);
  return { data: departamento ? (data || []).filter(item => item.operacao_embalagens?.departamento === departamento) : data, error };
}
