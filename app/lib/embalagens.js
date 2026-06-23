import { supabase } from "./supabase";

export async function fetchEmbalagens(unidadeId) {
  if (!unidadeId) return { data: [], error: 'Sem unidade' };
  const { data, error } = await supabase
    .from('operacao_embalagens')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('nome', { ascending: true });
  return { data, error };
}

export async function salvarEmbalagem(unidadeId, payload) {
  if (payload.id) {
    const { id, ...updateData } = payload;
    const { data, error } = await supabase
      .from('operacao_embalagens')
      .update(updateData)
      .eq('id', id)
      .eq('unidade_id', unidadeId)
      .select()
      .single();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from('operacao_embalagens')
      .insert({ ...payload, unidade_id: unidadeId })
      .select()
      .single();
    return { data, error };
  }
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
      .select('quantidade_atual')
      .eq('id', payload.embalagem_id)
      .single();
      
    if (estAtual) {
      await supabase
        .from('operacao_embalagens')
        .update({ quantidade_atual: Number(estAtual.quantidade_atual) - Number(payload.quantidade) })
        .eq('id', payload.embalagem_id);
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

export async function fetchListaComprasEmbalagens(unidadeId) {
  const { data, error } = await supabase
    .from('operacao_embalagens')
    .select('*')
    .eq('unidade_id', unidadeId);
    
  if (error) return { data: [], error };
  
  const lista = data.filter(e => Number(e.quantidade_atual) <= Number(e.quantidade_minima));
  return { data: lista, error: null };
}

export async function fetchHistoricoConsumoEmbalagens(unidadeId) {
  const { data, error } = await supabase
    .from('operacao_embalagens_consumo')
    .select(`
      *,
      colaboradores:funcionario_id (nome),
      operacao_embalagens:embalagem_id (nome)
    `)
    .eq('unidade_id', unidadeId)
    .order('data_registro', { ascending: false })
    .limit(100);
  return { data, error };
}
