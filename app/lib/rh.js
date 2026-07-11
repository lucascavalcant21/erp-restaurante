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

// Remove do payload qualquer coluna que o banco não reconheça e tenta de novo
// (evita quebrar cadastro por falta de migração de colunas novas).
async function colabRetrySemColuna(error, tentar, campos, n = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"? (?:of relation "colaboradores" )?does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && n < 8 && match[1] in campos) {
    delete campos[match[1]];
    return colabRetrySemColuna(await tentar(), tentar, campos, n + 1);
  }
  return error;
}

export async function inserirColaborador(colab) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  let res = await supabase.from("colaboradores").insert([colab]).select().single();
  let data = res.data;
  const error = await colabRetrySemColuna(res.error, async () => {
    const r = await supabase.from("colaboradores").insert([colab]).select().single(); data = r.data; return r.error;
  }, colab);
  return { data, error: error?.message };
}

export async function removerColaborador(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").delete().eq("id", id);
  return { error: error?.message };
}

// ─── DESLIGAMENTO (arquivo de ex-funcionários) ───────────────────────────────
// Não apaga: marca como inativo e guarda data/motivo/tipo. A vida (ponto,
// advertências, docs, banco...) fica preservada pelo mesmo id.
export async function desligarColaborador(id, { data_desligamento, motivo_desligamento, tipo_desligamento }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").update({
    status: "inativo",
    data_desligamento: data_desligamento || new Date().toISOString().split("T")[0],
    motivo_desligamento: motivo_desligamento || null,
    tipo_desligamento: tipo_desligamento || null,
  }).eq("id", id);
  return { error: error?.message };
}

export async function reativarColaborador(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").update({
    status: "ativo", data_desligamento: null, motivo_desligamento: null, tipo_desligamento: null,
  }).eq("id", id);
  return { error: error?.message };
}

// ─── GASTOS ADMINISTRATIVOS (material de escritório, cartões, etc.) ──────────
export async function fetchGastosAdmin(unidadeId, mesAno = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("gastos_administrativos").select("*").eq("unidade_id", unidadeId).order("data", { ascending: false });
  if (mesAno) {
    const [ano, mes] = String(mesAno).split("-").map(Number);
    const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
    q = q.gte("data", `${mesAno}-01`).lt("data", fim);
  }
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function salvarGastoAdmin(gasto) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, created_at, ...campos } = gasto;
  if (id) {
    const { error } = await supabase.from("gastos_administrativos").update(campos).eq("id", id);
    return { error: error?.message };
  }
  const { error } = await supabase.from("gastos_administrativos").insert([campos]);
  return { error: error?.message };
}

export async function removerGastoAdmin(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("gastos_administrativos").delete().eq("id", id);
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
  let res = await supabase.from("colaboradores").update(dados).eq("id", id).select().single();
  let data = res.data;
  const error = await colabRetrySemColuna(res.error, async () => {
    const r = await supabase.from("colaboradores").update(dados).eq("id", id).select().single(); data = r.data; return r.error;
  }, dados);
  return { data, error: error?.message };
};
export const atualizarColaborador = atualizarFuncionario;

// Escala: grava a ordem e/ou a área do colaborador (arrastar para reordenar e
// mover entre áreas). Se as colunas `ordem_escala`/`area_escala` ainda não
// existirem, o retry as remove (no-op) até rodar a migração.
export async function atualizarEscalaColab(id, campos) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const c = { ...campos };
  let { error } = await supabase.from("colaboradores").update(c).eq("id", id);
  error = await colabRetrySemColuna(error, async () => {
    const r = await supabase.from("colaboradores").update(c).eq("id", id); return r.error;
  }, c);
  return { error: error?.message };
}
export async function atualizarOrdemEscala(id, ordem_escala) {
  return atualizarEscalaColab(id, { ordem_escala });
}

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

// ─── BANCO DE HORAS (intervalo não tirado) ───────────────────────────────────
// Quando o colaborador não consegue tirar a folga/intervalo de 1h do dia (ou
// tira só parte), os minutos que faltaram acumulam aqui. Limite: 8h (480 min)
// por colaborador por mês.
export const BANCO_LIMITE_MIN = 480;  // 8h no mês
export const BANCO_ALERTA_MIN = 360;  // 6h = 75% -> perto de estourar

export async function fetchBancoHoras(unidadeId, mesAno) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const [ano, mes] = String(mesAno).split("-").map(Number);
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 1).toISOString().split("T")[0]; // 1º dia do mês seguinte
  const { data, error } = await supabase.from("rh_banco_horas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .gte("data", inicio)
    .lt("data", fim)
    .order("data", { ascending: false });
  return { data: data || [], error: error?.message };
}

// tipo: 'credito' (intervalo não tirado -> soma no banco) | 'excesso'
// (passou do intervalo -> só ocorrência no histórico, não soma no banco)
export async function inserirBancoHoras(unidadeId, colaboradorId, dataDia, minutos, observacao = "", tipo = "credito") {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_banco_horas").insert([{
    unidade_id: unidadeId,
    colaborador_id: colaboradorId,
    data: dataDia,
    minutos: Number(minutos) || 0,
    observacao: observacao || null,
    tipo,
  }]);
  return { error: error?.message };
}

// Soma só os CRÉDITOS do banco (excessos de intervalo são ocorrências)
export function somaMinutosBanco(lancamentos) {
  return (lancamentos || [])
    .filter(b => b.tipo !== "excesso")
    .reduce((s, b) => s + (Number(b.minutos) || 0), 0);
}

export async function removerBancoHoras(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_banco_horas").delete().eq("id", id);
  return { error: error?.message };
}

// ─── REMUNERAÇÃO (CLT simplificada) ─────────────────────────────────────────
// Regras da casa: adicional noturno começa às 23:30 (20% sobre a hora normal,
// ref. CLT art. 73); o que passar de 00:00 conta como hora extra (+50%,
// ref. CF art. 7º XVI); dia trabalhado em FERIADO paga adicional de 100%
// (dobro, Lei 605/49 art. 9º). Hora normal = salário ÷ 220 (divisor CLT).
export function calcularAdicionaisMes(pontosMes, salarioBase, feriados = []) {
  const valorHora = (Number(salarioBase) || 0) / 220;
  const feriadosSet = new Set((feriados || []).map(f => f.data || f));
  let minNoturno = 0;   // 23:30 → 00:00
  let minExtra = 0;     // após 00:00
  let minFeriado = 0;   // horas trabalhadas em dia de feriado

  (pontosMes || []).forEach(reg => {
    if (!reg.hora_entrada || !reg.hora_saida) return;
    const entrada = new Date(reg.hora_entrada);
    const saida = new Date(reg.hora_saida);
    if (saida <= entrada) return;

    // Marco das 23:30 do dia da entrada e a meia-noite seguinte
    const marco2330 = new Date(entrada); marco2330.setHours(23, 30, 0, 0);
    const meiaNoite = new Date(marco2330); meiaNoite.setMinutes(meiaNoite.getMinutes() + 30);

    // Minutos trabalhados entre 23:30 e 00:00 → adicional noturno
    const iniNot = Math.max(entrada.getTime(), marco2330.getTime());
    const fimNot = Math.min(saida.getTime(), meiaNoite.getTime());
    if (fimNot > iniNot) minNoturno += Math.round((fimNot - iniNot) / 60000);

    // Minutos após a meia-noite → hora extra
    if (saida.getTime() > meiaNoite.getTime()) {
      minExtra += Math.round((saida.getTime() - meiaNoite.getTime()) / 60000);
    }

    // Dia de feriado: todas as horas trabalhadas pagam +100%
    if (feriadosSet.has(reg.data_referencia)) {
      // Desconta o intervalo, se registrado
      let minDia = Math.round((saida - entrada) / 60000);
      if (reg.hora_saida_intervalo && reg.hora_retorno_intervalo) {
        minDia -= Math.max(0, Math.round((new Date(reg.hora_retorno_intervalo) - new Date(reg.hora_saida_intervalo)) / 60000));
      }
      if (minDia > 0) minFeriado += minDia;
    }
  });

  const valorNoturno = (minNoturno / 60) * valorHora * 0.20;      // só o adicional de 20%
  const valorExtra = (minExtra / 60) * valorHora * 1.50;          // hora cheia + 50%
  const valorFeriado = (minFeriado / 60) * valorHora * 1.00;      // adicional de 100% (dobro)
  return {
    minNoturno, minExtra, minFeriado,
    valorNoturno: Math.round(valorNoturno * 100) / 100,
    valorExtra: Math.round(valorExtra * 100) / 100,
    valorFeriado: Math.round(valorFeriado * 100) / 100,
  };
}

// ─── FERIADOS DA UNIDADE ─────────────────────────────────────────────────────
export async function fetchFeriados(unidadeId, mesAno = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("rh_feriados").select("*").eq("unidade_id", unidadeId).order("data");
  if (mesAno) {
    const [ano, mes] = String(mesAno).split("-").map(Number);
    const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
    q = q.gte("data", `${mesAno}-01`).lt("data", fim);
  }
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function inserirFeriado(unidadeId, data, nome) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_feriados").insert([{ unidade_id: unidadeId, data, nome: nome || null }]);
  return { error: error?.message };
}

export async function removerFeriado(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_feriados").delete().eq("id", id);
  return { error: error?.message };
}

// ─── ADVERTÊNCIAS ────────────────────────────────────────────────────────────
export async function fetchAdvertenciasColab(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const { data, error } = await supabase.from("rh_advertencias_colab")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function inserirAdvertencia(adv) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_advertencias_colab").insert([adv]);
  return { error: error?.message };
}

export async function removerAdvertencia(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_advertencias_colab").delete().eq("id", id);
  return { error: error?.message };
}

// Banco de horas de UM colaborador no mês (para a tela de ponto e o espelho)
export async function fetchBancoHorasColaborador(colaboradorId, mesAno) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const [ano, mes] = String(mesAno).split("-").map(Number);
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
  const { data, error } = await supabase.from("rh_banco_horas")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("data", inicio)
    .lt("data", fim)
    .order("data", { ascending: false });
  return { data: data || [], error: error?.message };
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

export async function fetchValesPendentes(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };

  let query = supabase
    .from("rh_consumo_funcionarios")
    .select("*")
    .eq("forma_pagamento", "Desconto em Folha")
    .eq("status_pagamento", "Pendente");

  if (unidadeId && unidadeId !== "todas") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
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

  const descricoes = pagamentos.map(p => `Salário ${mesStr}/${anoStr} - ${p.nome}`);
  const { data: contasExistentes, error: erroConsultaContas } = await supabase
    .from("contas_pagar")
    .select("descricao")
    .eq("unidade_id", unidadeId)
    .in("descricao", descricoes);
  if (erroConsultaContas) return { error: erroConsultaContas.message };

  const descricoesExistentes = new Set((contasExistentes || []).map(c => c.descricao));
  const contasParaInserir = pagamentos.filter(p => !descricoesExistentes.has(`Salário ${mesStr}/${anoStr} - ${p.nome}`)).map(p => ({
    unidade_id: unidadeId,
    descricao: `Salário ${mesStr}/${anoStr} - ${p.nome}`,
    valor: Number(p.valor_liquido),
    data_vencimento: dataVencimento,
    categoria: 'cmo',
    status: 'pendente'
  }));

  if (contasParaInserir.length > 0) {
    const { error } = await supabase.from("contas_pagar").insert(contasParaInserir);
    if (error) return { error: error.message };
  }

  const { data: holeritesExistentes, error: erroConsultaHolerites } = await supabase
    .from("holerites")
    .select("id, func_id")
    .eq("unidade_id", unidadeId)
    .eq("mes", Number(mesStr))
    .eq("ano", Number(anoStr));
  if (erroConsultaHolerites) return { error: erroConsultaHolerites.message };

  const holeritePorFuncionario = new Map((holeritesExistentes || []).map(h => [h.func_id, h]));
  for (const p of pagamentos) {
    const payload = {
      func_id: p.colaborador_id,
      mes: Number(mesStr),
      ano: Number(anoStr),
      bruto: Number(p.base_calculada || 0) + Number(p.acrescimos || 0),
      liquido: Number(p.valor_liquido || 0),
      unidade_id: unidadeId,
      detalhes: {
        nome: p.nome,
        cargo: p.cargo || "",
        tipo_contrato: p.tipo_contrato || "",
        dias_trabalhados: Number(p.dias_trabalhados || 0),
        salario_base: Number(p.base_calculada || 0),
        acrescimos: Number(p.acrescimos || 0),
        vales: Number(p.total_vales_pendentes || 0),
        outros_descontos: Number(p.descontos_manuais || 0),
        competencia: mesAno,
        fechado_em: new Date().toISOString()
      }
    };
    const existente = holeritePorFuncionario.get(p.colaborador_id);
    const operacao = existente
      ? supabase.from("holerites").update(payload).eq("id", existente.id)
      : supabase.from("holerites").insert([payload]);
    const { error: erroHolerite } = await operacao;
    if (erroHolerite) return { error: `Holerite de ${p.nome}: ${erroHolerite.message}` };
  }

  const valesParaBaixar = pagamentos.flatMap(p => p.vales_descontados_ids || []);
  if (valesParaBaixar.length > 0) {
    const dataHoje = new Date().toISOString();
    await supabase.from("rh_consumo_funcionarios")
      .update({ status_pagamento: 'Pago', data_pagamento: dataHoje })
      .in('id', valesParaBaixar);
  }

  return {
    success: true,
    holeritesGerados: pagamentos.length,
    contasCriadas: contasParaInserir.length,
    contasJaExistentes: pagamentos.length - contasParaInserir.length
  };
}
