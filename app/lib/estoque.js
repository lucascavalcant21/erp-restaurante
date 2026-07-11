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

// Produções registradas nos últimos N dias (para o relatório gerencial)
export async function fetchProducoesPeriodo(unidadeId, dias = 30) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const inicio = new Date(Date.now() - dias * 86400000).toISOString();
  const { data, error } = await supabase
    .from("producao_diaria")
    .select("*, fichas_tecnicas(nome_receita), colaboradores(nome)")
    .eq("unidade_id", unidadeId)
    .gte("created_at", inicio)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function registrarProducao(unidadeId, ficha, qtdProduzida, colaboradorId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // 1. Inserimos o log da produção
  // 2. Buscamos o estoque atual dos INSUMOS dessa ficha (ignora sub-fichas/bases)
  const insumosFicha = (ficha.fichas_ingredientes || []).filter(i => i.insumos);
  const consumoPorInsumo = {};
  insumosFicha.forEach(ing => {
     const id = ing.insumos.id;
     if (!consumoPorInsumo[id]) consumoPorInsumo[id] = { insumo: ing.insumos, quantidade: 0 };
     consumoPorInsumo[id].quantidade += Number(ing.quantidade || 0) * Number(qtdProduzida || 0);
  });
  const ingIds = Object.keys(consumoPorInsumo);
  
  const { data: estoqueDB, error: errConsultaEstoque } = await supabase.from("estoque_atual")
     .select("insumo_id, quantidade_atual")
     .eq("unidade_id", unidadeId)
     .in("insumo_id", ingIds);

  if (errConsultaEstoque) return { error: errConsultaEstoque.message };

  const mapaEstoque = {};
  if(estoqueDB) {
     estoqueDB.forEach(e => mapaEstoque[e.insumo_id] = e.quantidade_atual);
  }

  // 3. Calculamos o novo saldo e preparamos o array de Upsert
  const faltantes = Object.entries(consumoPorInsumo).map(([id, item]) => ({
     id,
     nome: item.insumo.nome,
     unidade: item.insumo.unidade_medida,
     necessario: item.quantidade,
     disponivel: Number(mapaEstoque[id] || 0),
  })).filter(item => item.disponivel < item.necessario);

  if (faltantes.length > 0) {
     return { error: "Estoque insuficiente", codigo: "ESTOQUE_INSUFICIENTE", faltantes };
  }

  const atualizacoesEstoque = Object.entries(consumoPorInsumo).map(([id, item]) => {
     const saldoAnterior = Number(mapaEstoque[id] || 0);
     const novoSaldo = saldoAnterior - item.quantidade;

     return {
        unidade_id: unidadeId,
        insumo_id: id,
        quantidade_atual: novoSaldo,
        updated_at: new Date().toISOString()
     };
  });

  // 4. Salva as baixas no estoque de uma vez só!
  if (atualizacoesEstoque.length > 0) {
     const { error: errUpsert } = await supabase.from("estoque_atual").upsert(atualizacoesEstoque, { onConflict: 'unidade_id, insumo_id' });
     if(errUpsert) return { error: errUpsert.message };
  }

  const { error: errLog } = await supabase.from("producao_diaria").insert([{
     unidade_id: unidadeId,
     ficha_id: ficha.id,
     colaborador_id: colaboradorId,
     quantidade_produzida: qtdProduzida
  }]);

  if (errLog) {
     const reversao = Object.keys(consumoPorInsumo).map(id => ({
        unidade_id: unidadeId,
        insumo_id: id,
        quantidade_atual: Number(mapaEstoque[id] || 0),
        updated_at: new Date().toISOString()
     }));
     if (reversao.length > 0) {
        await supabase.from("estoque_atual").upsert(reversao, { onConflict: 'unidade_id, insumo_id' });
     }
     return { error: errLog.message };
  }

  return { success: true };
}

// ─── COMPRAS (Integração Estoque -> Financeiro) ──────────────────────────────
export async function registrarCompra(unidadeId, insumoId, nomeInsumo, departamento, quantidadeComprada, valorPago, fornecedorNome = "") {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // 1. Aumenta o Estoque
  const { data: estoqueDB } = await supabase.from("estoque_atual")
     .select("quantidade_atual")
     .eq("unidade_id", unidadeId)
     .eq("insumo_id", insumoId)
     .maybeSingle();

  const saldoAnterior = estoqueDB ? estoqueDB.quantidade_atual : 0;
  const { error: errEstoque } = await ajustarEstoque(unidadeId, insumoId, saldoAnterior + quantidadeComprada);
  if (errEstoque) return { error: errEstoque };

  // 2. Lança no Contas a Pagar (Financeiro)
  const categoria = 'cmv'; // Unificado conforme solicitado
  const hoje = new Date().toISOString().split('T')[0];
  const descForn = fornecedorNome ? ` (Fornecedor: ${fornecedorNome})` : "";

  const { error } = await supabase.from("contas_pagar").insert([{
     unidade_id: unidadeId,
     descricao: `Compra: ${quantidadeComprada}x ${nomeInsumo}${descForn}`,
     valor: valorPago,
     data_vencimento: hoje,
     categoria: categoria,
     status: 'pendente'
  }]);
  if (error) return { error: error.message };

  return { success: true };
}

export const fetchHistoricoTablet = async () => { return { data: [], error: null }; };
export const movimentarTablet = async () => { return { error: null }; };
