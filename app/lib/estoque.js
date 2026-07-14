import { supabase, isSupabaseReady } from "./supabase";

// ─── ESTOQUE FÍSICO ──────────────────────────────────────────────────────────

export async function fetchEstoque(unidadeId, deptUrl) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Trazemos todos os insumos (o * inclui estoque_minimo quando a coluna
  // existir) e fazemos um LEFT JOIN com o estoque_atual
  let query = supabase.from("insumos")
    .select(`*, estoque_atual (quantidade_atual)`)
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
     estoque_minimo: ins.estoque_minimo ?? null,
     quantidade_atual: ins.estoque_atual?.[0]?.quantidade_atual || 0
  }));

  return { data: formatado, error: error?.message };
}

// Estoque mínimo do insumo (abaixo dele o item entra na lista de compras).
// Se a coluna ainda não existir no banco, avisa para rodar o SQL.
export async function atualizarMinimoInsumo(insumoId, estoque_minimo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("insumos")
    .update({ estoque_minimo: estoque_minimo === "" || estoque_minimo === null ? null : Number(estoque_minimo) })
    .eq("id", insumoId);
  if (error && /estoque_minimo/.test(error.message || "")) {
    return { error: "Rode o SQL que cria a coluna estoque_minimo (te passei no chat)." };
  }
  return { error: error?.message };
}

export async function atualizarMaximoInsumo(insumoId, estoque_maximo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("insumos")
    .update({ estoque_maximo: estoque_maximo === "" || estoque_maximo === null ? null : Number(estoque_maximo) })
    .eq("id", insumoId);
  if (error && /estoque_maximo/.test(error.message || "")) {
    return { error: "Rode o SQL que cria a coluna estoque_maximo (alter table insumos add column if not exists estoque_maximo numeric)." };
  }
  return { error: error?.message };
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

export function calcularConsumoProducao(ficha, qtdProduzida, todasFichas = []) {
  const fichasPorId = new Map((todasFichas || []).map(item => [item.id, item]));
  if (ficha?.id) fichasPorId.set(ficha.id, ficha);

  const consumo = new Map();
  const erros = [];

  function visitar(atual, fator, trilha = new Set()) {
    if (!atual) return;
    if (trilha.has(atual.id)) {
      erros.push(`Referência circular encontrada na receita ${atual.nome_receita || "sem nome"}.`);
      return;
    }

    const proximaTrilha = new Set(trilha);
    proximaTrilha.add(atual.id);

    (atual.fichas_ingredientes || []).forEach(item => {
      if (item.insumos) {
        const id = item.insumos.id;
        const quantidade = Number(item.quantidade || 0) * fator;
        const existente = consumo.get(id) || { insumo: item.insumos, quantidade: 0 };
        existente.quantidade += quantidade;
        consumo.set(id, existente);
        return;
      }

      if (item.subficha_id) {
        const base = fichasPorId.get(item.subficha_id);
        if (!base) {
          erros.push(`Base não encontrada na receita ${atual.nome_receita || "sem nome"}.`);
          return;
        }
        const rendimentoBase = Number(base.rendimento_porcoes) || 1;
        const fatorBase = fator * Number(item.quantidade || 0) / rendimentoBase;
        visitar(base, fatorBase, proximaTrilha);
      }
    });
  }

  visitar(ficha, Number(qtdProduzida || 0));
  return { itens: Array.from(consumo.values()), erros };
}

export async function registrarProducao(unidadeId, ficha, qtdProduzida, colaboradorId, todasFichas = []) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // Calcula e valida a baixa antes de registrar o histórico da produção.
  const calculo = calcularConsumoProducao(ficha, qtdProduzida, todasFichas);
  if (calculo.erros.length > 0) {
     return { error: calculo.erros.join(" "), codigo: "FICHA_INVALIDA" };
  }
  const consumoPorInsumo = {};
  calculo.itens.forEach(item => {
     const id = item.insumo.id;
     consumoPorInsumo[id] = item;
  });
  const ingIds = Object.keys(consumoPorInsumo);
  
  let estoqueDB = [];
  if (ingIds.length > 0) {
     const { data, error: errConsultaEstoque } = await supabase.from("estoque_atual")
        .select("insumo_id, quantidade_atual")
        .eq("unidade_id", unidadeId)
        .in("insumo_id", ingIds);
     if (errConsultaEstoque) return { error: errConsultaEstoque.message };
     estoqueDB = data || [];
  }

  const mapaEstoque = {};
  if(estoqueDB) {
     estoqueDB.forEach(e => mapaEstoque[e.insumo_id] = e.quantidade_atual);
  }

  // Impede saldo negativo e informa exatamente o que está faltando.
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

  // Salva a baixa e só então grava o histórico.
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
