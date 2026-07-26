import { supabase, isSupabaseReady } from "./supabase";

// Data local (São Paulo) em YYYY-MM-DD, com deslocamento opcional de dias
function dataLocalISO(offsetDias = 0) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  d.setDate(d.getDate() + offsetDias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Jornada da VÉSPERA ainda aberta (turno que virou a meia-noite): tem entrada,
// não tem saída, e a entrada foi há menos de 20h (não confunde com dia esquecido).
function jornadaAbertaDeOntem(reg) {
  if (!reg || !reg.hora_entrada || reg.hora_saida) return false;
  return (Date.now() - new Date(reg.hora_entrada).getTime()) < 20 * 3600000;
}

export async function fetchPontoHoje(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  const hoje = dataLocalISO(0);
  const ontem = dataLocalISO(-1);

  // Busca hoje E ontem: quem trabalha até depois da meia-noite continua na
  // jornada de ontem (sem isso, à 00h o sistema pedia ENTRADA de novo e a
  // saída ficava sem registro).
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("unidade_id", unidadeId)
    .in("data_referencia", [hoje, ontem])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pontos:", error);
    return { data: [] };
  }

  // Um registro por colaborador: o de HOJE vence; sem hoje, vale o de ontem
  // apenas se a jornada ainda estiver aberta (madrugada do turno noturno).
  const porColab = {};
  (data || []).forEach(r => {
    const atual = porColab[r.colaborador_id];
    if (r.data_referencia === hoje) {
      if (!atual || atual.data_referencia !== hoje) porColab[r.colaborador_id] = r;
    } else if (!atual && jornadaAbertaDeOntem(r)) {
      porColab[r.colaborador_id] = r;
    }
  });
  return { data: Object.values(porColab) };
}

export async function fetchHistoricoPonto(colaboradorId) {
  if (!isSupabaseReady()) return { data: [] };
  
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data_referencia", { ascending: false })
    .limit(7);
    
  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return { data: [] };
  }
  return { data };
}

export async function fetchHistoricoPontoCompleto(colaboradorId, limite = 365) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data_referencia", { ascending: false })
    .limit(limite);
  return { data: data || [], error: error?.message };
}

export async function fetchPontosMes(colaboradorId, anoMes) {
  if (!isSupabaseReady()) return { data: [] };
  
  // anoMes ex: '2026-06'
  const ano = parseInt(anoMes.split('-')[0]);
  const mes = parseInt(anoMes.split('-')[1]);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  
  const start = `${anoMes}-01`;
  const end = `${anoMes}-${ultimoDia.toString().padStart(2, '0')}`;
  
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("data_referencia", start)
    .lte("data_referencia", end)
    .order("data_referencia", { ascending: true });
    
  if (error) {
    console.error("Erro ao buscar pontos do mês:", error);
    return { data: [] };
  }
  return { data };
}

// Pontos do mês da UNIDADE inteira (uma query só — usado no salário previsto do RH)
export async function fetchPontosMesUnidade(unidadeId, anoMes) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const ano = parseInt(anoMes.split('-')[0]);
  const mes = parseInt(anoMes.split('-')[1]);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("colaborador_id, data_referencia, hora_entrada, hora_saida, hora_saida_intervalo, hora_retorno_intervalo")
    .eq("unidade_id", unidadeId)
    .gte("data_referencia", `${anoMes}-01`)
    .lte("data_referencia", `${anoMes}-${ultimoDia.toString().padStart(2, '0')}`);
  return { data: data || [], error: error?.message };
}

// Funcionário declarou que NÃO vai tirar o intervalo hoje: pula direto para o
// estado "voltou do intervalo" (sem horários de intervalo) — a próxima batida
// é a saída. Os minutos não tirados vão para o banco de horas (feito na tela).
export async function pularIntervalo(colaboradorId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const hoje = dataLocalISO(0);
  const ontem = dataLocalISO(-1);
  const { data: registros } = await supabase
    .from("registro_ponto")
    .select("id, hora_entrada, hora_saida, data_referencia")
    .eq("colaborador_id", colaboradorId)
    .in("data_referencia", [hoje, ontem])
    .order("data_referencia", { ascending: false });
  // Hoje primeiro; senão a jornada de ontem ainda aberta (madrugada)
  const registro = (registros || []).find(r => r.data_referencia === hoje)
    || (registros || []).find(r => r.data_referencia === ontem && jornadaAbertaDeOntem(r));
  if (!registro || !registro.hora_entrada) return { error: "Precisa bater a entrada primeiro." };
  const { error } = await supabase.from("registro_ponto")
    .update({ status_jornada: 3 })
    .eq("id", registro.id);
  return { error: error?.message };
}

// horaMarcada (ISO, opcional): hora AJUSTADA pela tolerância (Súmula 366 TST) —
// ex.: bateu 15:39 com turno 15:40 => grava 15:40. Sem ela, usa a hora real.
export async function registrarBatida(colaboradorId, unidadeId, tipoBatida, horaMarcada = null) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const hoje = dataLocalISO(0);
  const ontem = dataLocalISO(-1);
  const agora = horaMarcada || new Date().toISOString();

  // Busca o registro de hoje E o de ontem (turno noturno que virou a madrugada)
  let { data: registros, error: err } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .in("data_referencia", [hoje, ontem])
    .order("data_referencia", { ascending: false });

  const regHoje = (registros || []).find(r => r.data_referencia === hoje) || null;
  const regOntem = (registros || []).find(r => r.data_referencia === ontem) || null;

  // Sem registro hoje mas com a jornada de ONTEM aberta: as batidas continuam
  // nela (a saída depois da meia-noite fecha o dia de ontem, não abre um novo).
  let registro = regHoje;
  if (!registro && jornadaAbertaDeOntem(regOntem)) {
    if (tipoBatida === "entrada") {
      return { error: "A jornada de ontem ainda está aberta — bata a SAÍDA DO TRABALHO para encerrá-la antes de iniciar um novo dia." };
    }
    registro = regOntem;
  }
    
  let updates = {};
  let novoStatus = 0;
  
  if (tipoBatida === 'entrada') {
    updates = { hora_entrada: agora, status_jornada: 1 };
    novoStatus = 1;
  } else if (tipoBatida === 'saida_intervalo') {
    updates = { hora_saida_intervalo: agora, status_jornada: 2 };
    novoStatus = 2;
  } else if (tipoBatida === 'retorno_intervalo') {
    updates = { hora_retorno_intervalo: agora, status_jornada: 3 };
    novoStatus = 3;
  } else if (tipoBatida === 'saida_trabalho') {
    updates = { hora_saida: agora, status_jornada: 4 };
    novoStatus = 4;
  }
  
  if (!registro) {
    // Primeira batida do dia (entrada)
    if(tipoBatida !== 'entrada') return { error: "Precisa bater a entrada primeiro." };
    const { error } = await supabase.from("registro_ponto").insert([{
      colaborador_id: colaboradorId,
      unidade_id: unidadeId,
      data_referencia: hoje,
      ...updates
    }]);
    return { error: error?.message, novoStatus };
  } else {
    // Atualiza o registro existente
    const { error } = await supabase.from("registro_ponto").update(updates).eq("id", registro.id);
    return { error: error?.message, novoStatus };
  }
}
