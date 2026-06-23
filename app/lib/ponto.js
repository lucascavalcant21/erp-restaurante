import { supabase, isSupabaseReady } from "./supabase";

export async function fetchPontoHoje(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  const dataLocal = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hoje = dataLocal.getFullYear() + "-" + String(dataLocal.getMonth() + 1).padStart(2, '0') + "-" + String(dataLocal.getDate()).padStart(2, '0');
  
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("data_referencia", hoje)
    .order("created_at", { ascending: false });
    
  if (error) {
    console.error("Erro ao buscar pontos:", error);
    return { data: [] };
  }
  return { data };
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

export async function registrarBatida(colaboradorId, unidadeId, tipoBatida) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const dataLocal = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hoje = dataLocal.getFullYear() + "-" + String(dataLocal.getMonth() + 1).padStart(2, '0') + "-" + String(dataLocal.getDate()).padStart(2, '0');
  const agora = new Date().toISOString();
  
  // Buscar se já tem registro hoje
  let { data: registros, error: err } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .eq("data_referencia", hoje)
    .order("created_at", { ascending: false })
    .limit(1);
    
  let registro = registros && registros.length > 0 ? registros[0] : null;
    
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
