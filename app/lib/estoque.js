import { supabase, isSupabaseReady } from "./supabase";

// ─── ESTOQUE FÍSICO ──────────────────────────────────────────────────────────

export async function fetchEstoque(unidadeId, deptUrl) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Trazemos todos os insumos e fazemos um LEFT JOIN com o estoque_atual
  let query = supabase.from("insumos")
    .select(`
      id, nome, unidade_medida, custo_unitario, departamento,
      estoque_atual (quantidade_atual)
    `)
    .order("nome");

  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (deptUrl) query = query.eq("departamento", deptUrl);

  const { data, error } = await query;
  
  // Formata o array para facilitar o uso na tela
  const formatado = (data || []).map(ins => ({
     insumo_id: ins.id,
     nome: ins.nome,
     departamento: ins.departamento,
     unidade_medida: ins.unidade_medida,
     custo_unitario: ins.custo_unitario,
     quantidade_atual: ins.estoque_atual?.[0]?.quantidade_atual || 0
  }));

  return { data: formatado, error: error?.message };
}

// Para ajustes manuais (Balanço, Compras)
export async function ajustarEstoque(unidadeId, insumoId, novaQuantidade) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // O Supabase fará o UPSERT pois criamos a constraint UNIQUE(unidade_id, insumo_id)
  const { error } = await supabase.from("estoque_atual").upsert({
     unidade_id: unidadeId,
     insumo_id: insumoId,
     quantidade_atual: novaQuantidade,
     updated_at: new Date().toISOString()
  }, { onConflict: 'unidade_id, insumo_id' });

  return { error: error?.message };
}


// ─── PRODUÇÃO DIÁRIA (O Motor da Mágica) ────────────────────────────────────

export async function registrarProducao(unidadeId, ficha, qtdProduzida, colaboradorId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // 1. Inserimos o log da produção
  const { error: errLog } = await supabase.from("producao_diaria").insert([{
     unidade_id: unidadeId,
     ficha_id: ficha.id,
     colaborador_id: colaboradorId,
     quantidade_produzida: qtdProduzida
  }]);

  if(errLog) return { error: errLog.message };

  // 2. Buscamos o estoque atual de TODOS os ingredientes dessa ficha para poder subtrair
  const ingIds = ficha.fichas_ingredientes.map(i => i.insumos.id);
  
  const { data: estoqueDB } = await supabase.from("estoque_atual")
     .select("insumo_id, quantidade_atual")
     .eq("unidade_id", unidadeId)
     .in("insumo_id", ingIds);

  const mapaEstoque = {};
  if(estoqueDB) {
     estoqueDB.forEach(e => mapaEstoque[e.insumo_id] = e.quantidade_atual);
  }

  // 3. Calculamos o novo saldo e preparamos o array de Upsert
  const atualizacoesEstoque = ficha.fichas_ingredientes.map(ing => {
     const qtdConsumidaTotal = ing.quantidade * qtdProduzida;
     const saldoAnterior = mapaEstoque[ing.insumos.id] || 0;
     const novoSaldo = saldoAnterior - qtdConsumidaTotal;

     return {
        unidade_id: unidadeId,
        insumo_id: ing.insumos.id,
        quantidade_atual: novoSaldo,
        updated_at: new Date().toISOString()
     };
  });

  // 4. Salva as baixas no estoque de uma vez só!
  if (atualizacoesEstoque.length > 0) {
     const { error: errUpsert } = await supabase.from("estoque_atual").upsert(atualizacoesEstoque, { onConflict: 'unidade_id, insumo_id' });
     if(errUpsert) return { error: errUpsert.message };
  }

  return { success: true };
}
