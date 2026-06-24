import { supabase, isSupabaseReady } from "./supabase";

export async function fetchColaboradores(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  
  let query = supabase.from("colaboradores").select("*").order("nome");
  if (unidadeId && unidadeId !== "matriz") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function inserirColaborador(colab) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("colaboradores").insert([colab]).select().single();
  return { data, error: error?.message };
}

export async function removerColaborador(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").delete().eq("id", id);
  return { error: error?.message };
}

// Upload de Documentos para o Storage
export async function fetchDocumentos(colabId) {
  if (!isSupabaseReady()) return { data: [] };
  const { data } = await supabase.from("documentos_rh").select("*").eq("colaborador_id", colabId);
  return { data: data || [] };
}

export async function uploadDocumentoRH(colabId, arquivo) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const extensao = arquivo.name.split('.').pop();
  const nomeSeguro = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;
  const caminho = `${colabId}/${nomeSeguro}`;

  // 1. Tenta fazer o upload para o bucket 'rh-docs'
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('rh-docs')
    .upload(caminho, arquivo, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    if (uploadError.message.includes("Bucket not found")) {
      return { error: "Por favor, crie um Bucket público chamado 'rh-docs' no seu painel do Supabase (Storage) antes de fazer uploads." };
    }
    return { error: `Erro no upload: ${uploadError.message}` };
  }

  // 2. Pega a URL pública
  const { data: publicUrlData } = supabase.storage.from('rh-docs').getPublicUrl(caminho);
  const urlPublica = publicUrlData?.publicUrl || "";

  // 3. Salva no banco de dados (tabela documentos_rh)
  const { data: docSalvo, error: bdError } = await supabase.from("documentos_rh").insert([{
    colaborador_id: colabId,
    nome_arquivo: arquivo.name,
    tipo: extensao.toUpperCase(), // PDF, JPG, etc
    url_arquivo: urlPublica
  }]).select().single();

  return { data: docSalvo, error: bdError?.message };
}

export async function removerDocumento(docId, url_arquivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  // 1. Remove do Storage
  if (url_arquivo) {
    try {
      const parts = url_arquivo.split('/rh-docs/');
      if (parts.length === 2) {
         const caminho = parts[1];
         await supabase.storage.from('rh-docs').remove([caminho]);
      }
    } catch(e) {}
  }
  // 2. Remove do BD
  const { error } = await supabase.from("documentos_rh").delete().eq("id", docId);
  return { error: error?.message };
}

export async function fetchFuncionarios() { return { data: [], error: null }; }

export const inserirFuncionario = inserirColaborador;
export const removerFuncionario = removerColaborador;
export const atualizarFuncionario = async (id, dados) => {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("colaboradores").update(dados).eq("id", id).select().single();
  return { data, error: error?.message };
};
export const atualizarColaborador = atualizarFuncionario;

export async function fetchPontoMes(unidadeId, mesAno) { return { data: [], error: null }; }
export async function registrarPonto(dados) { return { data: null, error: null }; }

export async function fetchCargos(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_cargos").select("*").eq("unidade_id", unidadeId).order("nome");
  return { data: data || [], error: error?.message };
}

export async function inserirCargo(cargo, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = { ...cargo, unidade_id: unidadeId };
  const { error } = await supabase.from("rh_cargos").insert([payload]);
  return { error: error?.message };
}

export async function atualizarCargo(id, cargo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_cargos").update(cargo).eq("id", id);
  return { error: error?.message };
}

export async function removerCargo(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_cargos").delete().eq("id", id);
  return { error: error?.message };
}

export async function fetchRegulamento(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("rh_regulamentos").select("*").eq("unidade_id", unidadeId).single();
  // Se não existir, a query .single() pode retornar erro, lidamos com isso:
  if (error && error.code !== 'PGRST116') return { data: null, error: error.message };
  return { data: data || null, error: null };
}

export async function salvarRegulamento(unidadeId, texto, urlPdf) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data: existente } = await supabase.from("rh_regulamentos").select("id").eq("unidade_id", unidadeId).single();
  
  if (existente) {
    const payload = {};
    if (texto !== undefined) payload.texto_regulamento = texto;
    if (urlPdf !== undefined) payload.url_pdf = urlPdf;
    const { error } = await supabase.from("rh_regulamentos").update(payload).eq("id", existente.id);
    return { error: error?.message };
  } else {
    const payload = { unidade_id: unidadeId };
    if (texto !== undefined) payload.texto_regulamento = texto;
    if (urlPdf !== undefined) payload.url_pdf = urlPdf;
    const { error } = await supabase.from("rh_regulamentos").insert([payload]);
    return { error: error?.message };
  }
}

export async function uploadRegulamentoPDF(unidadeId, arquivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const extensao = arquivo.name.split('.').pop();
  const nomeSeguro = `regulamento-${unidadeId}-${Date.now()}.${extensao}`;
  
  const { error: uploadError } = await supabase.storage.from('rh-docs').upload(nomeSeguro, arquivo, { upsert: true });
  if (uploadError) return { error: uploadError.message };
  
  const { data: publicUrlData } = supabase.storage.from('rh-docs').getPublicUrl(nomeSeguro);
  const urlPublica = publicUrlData?.publicUrl || "";
  
  return salvarRegulamento(unidadeId, undefined, urlPublica);
}

// Os turnos não foram implementados no DB ainda, manter mocks para não quebrar a tela de config
export const fetchTurnos = async () => { return { data: [], error: null }; };
export const inserirTurno = async () => { return { error: null }; };
export const atualizarTurno = async () => { return { error: null }; };
export const removerTurno = async () => { return { error: null }; };
export const inserirCargosPadrao = async () => { return { error: null }; };

export async function fetchAllFolgasDaUnidade(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_folgas_esporadicas").select("*").eq("unidade_id", unidadeId);
  return { data: data || [], error: error?.message };
}

export async function fetchFolgasEsporadicas(colaboradorId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_folgas_esporadicas").select("*").eq("colaborador_id", colaboradorId).order("data_folga");
  return { data: data || [], error: error?.message };
}

export async function inserirFolgaEsporadica(unidadeId, colaboradorId, dataFolga, descricao = "") {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_folgas_esporadicas").insert([{
    unidade_id: unidadeId,
    colaborador_id: colaboradorId,
    data_folga: dataFolga,
    descricao: descricao
  }]);
  return { error: error?.message };
}

export async function removerFolgaEsporadica(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_folgas_esporadicas").delete().eq("id", id);
  return { error: error?.message };
}

export async function fetchConsumoFuncionario(colaboradorId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_consumo_funcionarios").select("*").eq("funcionario_id", colaboradorId).order("data_consumo", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function inserirConsumoFuncionario(dados) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_consumo_funcionarios").insert([dados]);
  return { error: error?.message };
}

export async function atualizarStatusConsumo(id, status_pagamento, forma_pagamento) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  const payload = { status_pagamento };
  if (forma_pagamento) payload.forma_pagamento = forma_pagamento;
  if (status_pagamento === "Pago") {
    payload.data_pagamento = new Date().toISOString();
  }

  const { error } = await supabase.from("rh_consumo_funcionarios").update(payload).eq("id", id);
  return { error: error?.message };
}

export async function removerConsumoFuncionario(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_consumo_funcionarios").delete().eq("id", id);
  return { error: error?.message };
}

// ============================================================================
// FECHAMENTO DE FOLHA
// ============================================================================

export async function fetchResumoFolhaMensal(unidadeId, mesAno) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };

  // 1. Busca Colaboradores
  const { data: colaboradores } = await fetchColaboradores(unidadeId);
  if (!colaboradores) return { data: [] };

  // 2. Busca Pontos do Mês
  const dataInicial = `${mesAno}-01`;
  const ano = parseInt(mesAno.split('-')[0]);
  const mes = parseInt(mesAno.split('-')[1]);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFinal = `${mesAno}-${ultimoDia.toString().padStart(2, '0')}`;

  let queryPonto = supabase.from("registro_ponto")
    .select("colaborador_id, data_referencia")
    .gte("data_referencia", dataInicial)
    .lte("data_referencia", dataFinal);
    
  if (unidadeId && unidadeId !== "matriz") {
    queryPonto = queryPonto.eq("unidade_id", unidadeId);
  }

  const { data: pontos } = await queryPonto;
  const pontosSeguros = pontos || [];

  // 3. Busca Vales Pendentes
  let queryVales = supabase.from("rh_consumo_funcionarios")
    .select("*")
    .eq("forma_pagamento", "Desconto em Folha")
    .eq("status_pagamento", "Pendente")
    .lte("data_consumo", dataFinal + "T23:59:59Z");

  const { data: vales } = await queryVales;
  const valesSeguros = vales || [];

  const resumo = colaboradores.map(c => {
    const diasTrabalhados = new Set(pontosSeguros.filter(p => p.colaborador_id === c.id).map(p => p.data_referencia)).size;
    const meusVales = valesSeguros.filter(v => v.funcionario_id === c.id);
    const totalVales = meusVales.reduce((acc, v) => acc + Number(v.valor_final), 0);

    const isFreelancer = c.tipo_contrato === "Freelancer";
    const salarioBaseNumber = Number(c.salario || 0);
    
    let baseCalculada = 0;
    if (isFreelancer) {
      baseCalculada = diasTrabalhados * salarioBaseNumber;
    } else {
      baseCalculada = salarioBaseNumber;
    }

    return {
      colaborador_id: c.id,
      nome: c.nome,
      cargo: c.cargo,
      tipo_contrato: c.tipo_contrato,
      salario_cadastrado: salarioBaseNumber,
      dias_trabalhados: diasTrabalhados,
      base_calculada: baseCalculada,
      total_vales_pendentes: totalVales,
      vales_detalhes: meusVales
    };
  });

  return { data: resumo };
}

export async function fecharFolhaMensal(unidadeId, mesAno, pagamentos) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const [anoStr, mesStr] = mesAno.split('-');
  let ano = parseInt(anoStr);
  let mes = parseInt(mesStr); 
  
  mes += 1;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  
  let dia = 1;
  let diasUteis = 0;
  let dataVencimento = null;
  
  while (diasUteis < 5) {
    const data = new Date(ano, mes - 1, dia);
    const diaSemana = data.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteis++;
    }
    if (diasUteis === 5) {
      dataVencimento = `${ano}-${mes.toString().padStart(2,'0')}-${dia.toString().padStart(2,'0')}`;
      break;
    }
    dia++;
  }

  const contasParaInserir = pagamentos.map(p => ({
    unidade_id: unidadeId,
    descricao: `Salário ${mesStr}/${anoStr} - ${p.nome}`,
    valor: Number(p.valor_liquido),
    data_vencimento: dataVencimento,
    categoria: 'cmo',
    status: 'pendente'
  }));

  const { error } = await supabase.from("contas_pagar").insert(contasParaInserir);
  if (error) return { error: error.message };

  const valesParaBaixar = pagamentos.flatMap(p => p.vales_descontados_ids || []);
  if (valesParaBaixar.length > 0) {
    const dataHoje = new Date().toISOString();
    await supabase.from("rh_consumo_funcionarios")
      .update({ status_pagamento: 'Pago', data_pagamento: dataHoje })
      .in('id', valesParaBaixar);
  }

  return { success: true };
}
