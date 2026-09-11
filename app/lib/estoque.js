import { supabase, isSupabaseReady } from "./supabase";
import { registrarProducaoNoEstoquePreparo } from "./estoques-multiplos";

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
     id: ins.id,
     insumo_id: ins.id,
     nome: ins.nome,
     departamento: ins.departamento,
     unidade_medida: ins.unidade_medida,
     tamanho_embalagem: Number(ins.tamanho_embalagem) || 1,
     custo_unitario: ins.custo_unitario,
     custo_compra: Number(ins.custo_compra) || 0,
     estoque_minimo: ins.estoque_minimo ?? null,
     estoque_maximo: ins.estoque_maximo ?? null,
     // "ingrediente" (padrão) ou "produto" (pronto: bebidas, embalados etc.)
     tipo: ins.tipo || "ingrediente",
     marca: ins.marca || "",
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

// O que foi produzido HOJE nesta unidade. A tela do funcionario usa para
// mostrar o que ele mesmo fez e para descontar do plano do dia o que ja saiu.
// Sem colaboradorId devolve a producao do setor inteiro, que e o que a
// lideranca precisa ver.
export async function fetchProducaoDeHoje(unidadeId, { colaboradorId = null, departamento = null } = {}) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  // Virada do dia pelo relogio local: as 23h de um sabado ainda e sabado para
  // quem esta na cozinha, mesmo que em UTC ja seja domingo.
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();

  let consulta = supabase
    .from("producao_diaria")
    .select("*, fichas_tecnicas(nome_receita, rendimento_unidade, eh_base, departamento), colaboradores(nome)")
    .eq("unidade_id", unidadeId)
    .gte("created_at", inicio)
    .order("created_at", { ascending: false });
  if (colaboradorId) consulta = consulta.eq("colaborador_id", colaboradorId);

  const { data, error } = await consulta;
  if (error) return { data: [], error: error.message };

  // O filtro por setor fica aqui e nao na consulta: producao antiga nao tem a
  // coluna departamento preenchida, e nesse caso o setor vem da ficha.
  const lista = (data || []).filter((registro) => {
    if (!departamento) return true;
    const setor = registro.departamento || registro.fichas_tecnicas?.departamento;
    return !setor || String(setor).toLowerCase() === String(departamento).toLowerCase();
  });
  return { data: lista, error: null };
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

export async function registrarProducao(unidadeId, ficha, qtdProduzida, colaboradorId, todasFichas = [], opcoes = {}) {
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

  // Setor e local no proprio registro: a tela do funcionario le daqui o que ele
  // fez hoje, sem ter que passar por cada ficha para descobrir de onde veio.
  const registroProducao = {
     unidade_id: unidadeId,
     ficha_id: ficha.id,
     colaborador_id: colaboradorId,
     quantidade_produzida: qtdProduzida,
     departamento: opcoes.departamento || ficha.departamento || null,
     local_armazenamento: ficha.eh_base ? (opcoes.localArmazenamento || null) : null,
  };
  let { data: logProducao, error: errLog } = await supabase.from("producao_diaria").insert([registroProducao]).select("id").single();
  // Colunas novas so existem depois da migracao; sem ela grava o basico em vez
  // de recusar a producao inteira por causa de um campo acessorio.
  if (errLog && /column .* does not exist|could not find/i.test(errLog.message || "")) {
     const r = await supabase.from("producao_diaria").insert([{
        unidade_id: unidadeId, ficha_id: ficha.id,
        colaborador_id: colaboradorId, quantidade_produzida: qtdProduzida,
     }]).select("id").single();
     logProducao = r.data; errLog = r.error;
  }

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

  // Pré-preparo concluído vira saldo físico no estoque correspondente,
  // separado pelo freezer/geladeira escolhido na produção.
  if (ficha.eh_base) {
     const custoTotal = calculo.itens.reduce((total, item) => total + item.quantidade * Number(item.insumo.custo_unitario || 0), 0);
     const resultadoPreparo = await registrarProducaoNoEstoquePreparo({
        unidadeId,
        ficha,
        departamento: opcoes.departamento || ficha.departamento,
        quantidade: qtdProduzida,
        local: opcoes.localArmazenamento,
        usuarioId: colaboradorId,
        usuarioNome: opcoes.colaboradorNome || "",
        custoUnitario: qtdProduzida > 0 ? custoTotal / qtdProduzida : 0,
     });
     if (resultadoPreparo.error) {
        if (logProducao?.id) await supabase.from("producao_diaria").delete().eq("id", logProducao.id);
        const reversao = Object.keys(consumoPorInsumo).map(id => ({
           unidade_id: unidadeId,
           insumo_id: id,
           quantidade_atual: Number(mapaEstoque[id] || 0),
           updated_at: new Date().toISOString(),
        }));
        if (reversao.length > 0) await supabase.from("estoque_atual").upsert(reversao, { onConflict: "unidade_id,insumo_id" });
        return { error: `Não foi possível guardar o pré-preparo: ${resultadoPreparo.error}` };
     }
     return { success: true, preparo: resultadoPreparo.data };
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

// Total de reposição (compras) lançado no mês — soma dos valores das entradas.
export async function fetchReposicaoMes(unidadeId, mesAno) {
  if (!isSupabaseReady()) return { total: 0 };
  const [ano, mes] = String(mesAno).split("-").map(Number);
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 1).toISOString().slice(0, 10); // 1º dia do mês seguinte
  let q = supabase.from("contas_pagar").select("valor").gte("data_vencimento", inicio).lt("data_vencimento", fim).ilike("descricao", "Compra:%");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data } = await q;
  return { total: (data || []).reduce((s, c) => s + (Number(c.valor) || 0), 0) };
}

// ─── MOVIMENTAÇÕES INTEGRADAS ───────────────────────────────────────────────

export async function fetchMovimentosEstoque(unidadeId, departamento, limite = 300) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [], error: null };

  let query = supabase
    .from("estoque_movimentos")
    .select("id, unidade_id, insumo_id, departamento, tipo, quantidade_unidades, conteudo_por_unidade, quantidade_base, unidade_medida, saldo_anterior, saldo_posterior, responsavel, motivo, data_movimento, created_at, insumo:insumo_id(nome, marca)")
    .eq("unidade_id", unidadeId)
    .order("data_movimento", { ascending: false })
    .limit(limite);

  if (departamento) query = query.eq("departamento", departamento);
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function registrarMovimentoEstoque({
  unidadeId,
  insumoId,
  departamento,
  tipo,
  quantidadeUnidades,
  responsavel = "",
  motivo = "",
  dataMovimento,
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || !insumoId) return { error: "Produto ou unidade não informado." };
  if (!["entrada", "saida"].includes(tipo)) return { error: "Tipo de movimentação inválido." };
  if (!Number.isFinite(Number(quantidadeUnidades)) || Number(quantidadeUnidades) <= 0) {
    return { error: "Informe uma quantidade maior que zero." };
  }

  // 1. Tenta via RPC do Supabase
  const { data, error } = await supabase.rpc("registrar_movimento_estoque", {
    p_unidade_id: unidadeId,
    p_insumo_id: insumoId,
    p_departamento: departamento || null,
    p_tipo: tipo,
    p_quantidade_unidades: Number(quantidadeUnidades),
    p_responsavel: responsavel.trim() || null,
    p_motivo: motivo.trim() || null,
    p_data_movimento: dataMovimento ? new Date(dataMovimento).toISOString() : new Date().toISOString(),
  });

  // Se a RPC não existir ou falhar, executa o fallback diretamente pelas tabelas do Supabase
  if (error) {
    console.warn("RPC registrar_movimento_estoque falhou/ausente, executando fallback JS:", error.message);
    const { data: insumo } = await supabase.from("insumos").select("*").eq("id", insumoId).single();
    if (!insumo) return { error: "Insumo não encontrado." };

    const conteudo = Number(insumo.tamanho_embalagem) || 1;
    const qtdBase = Number(quantidadeUnidades) * conteudo;

    const { data: estoqueDB } = await supabase.from("estoque_atual")
      .select("quantidade_atual")
      .eq("unidade_id", unidadeId)
      .eq("insumo_id", insumoId)
      .maybeSingle();

    const saldoAnterior = Number(estoqueDB?.quantidade_atual) || 0;
    const MathSaldo = tipo === "entrada" ? saldoAnterior + qtdBase : saldoAnterior - qtdBase;
    const novoSaldo = Math.max(0, MathSaldo);

    const { error: errEstoque } = await ajustarEstoque(unidadeId, insumoId, novoSaldo);
    if (errEstoque) return { error: errEstoque };

    const dataIso = dataMovimento ? new Date(dataMovimento).toISOString() : new Date().toISOString();
    await supabase.from("estoque_movimentos").insert([{
      unidade_id: unidadeId,
      insumo_id: insumoId,
      departamento: departamento || insumo.departamento,
      tipo: tipo,
      quantidade_unidades: Number(quantidadeUnidades),
      conteudo_por_unidade: conteudo,
      quantidade_base: qtdBase,
      unidade_medida: insumo.unidade_medida,
      saldo_anterior: saldoAnterior,
      saldo_posterior: novoSaldo,
      responsavel: responsavel.trim() || "Sistema",
      motivo: motivo.trim() || (tipo === "entrada" ? "Entrada de estoque" : "Baixa de estoque"),
      data_movimento: dataIso,
    }]);

    return { success: true, novoSaldo, error: null };
  }

  return { data: Array.isArray(data) ? data[0] : data, error: null };
}

// Compatibilidade com a tela de operação rápida (tablet).
export async function fetchHistoricoTablet(unidadeId, setor) {
  const { data, error } = await fetchMovimentosEstoque(unidadeId, setor, 100);
  return {
    data: (data || []).map(mov => ({
      id: mov.id,
      tipo: mov.tipo === "saida" ? "SAIDA" : "ENTRADA",
      quantidade: Number(mov.quantidade_unidades) || 0,
      motivo: mov.motivo || "",
      responsavel: mov.responsavel || "",
      created_at: mov.data_movimento || mov.created_at,
      estoque: {
        id: mov.insumo_id,
        nome: mov.insumo?.nome || "Produto",
        unidade: "un.",
      },
    })),
    error,
  };
}

export async function movimentarTablet({ unidadeId, estoqueId, setor, tipo, quantidade, motivo, responsavel }) {
  return registrarMovimentoEstoque({
    unidadeId,
    insumoId: estoqueId,
    departamento: setor,
    tipo: String(tipo).toLowerCase() === "saida" ? "saida" : "entrada",
    quantidadeUnidades: quantidade,
    motivo,
    responsavel,
  });
}
