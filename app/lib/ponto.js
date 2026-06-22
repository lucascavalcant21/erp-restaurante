import { supabase, isSupabaseReady } from "./supabase";

export async function fetchPontoHoje(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  const hoje = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("data_referencia", hoje);
    
  if (error) {
    console.error("Erro ao buscar pontos:", error);
    return { data: [] };
  }
  return { data };
}

export async function registrarBatida(colaboradorId, unidadeId, tipoBatida) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const hoje = new Date().toISOString().split('T')[0];
  const agora = new Date().toISOString();
  
  // Buscar se já tem registro hoje
  let { data: registro } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .eq("data_referencia", hoje)
    .single();
    
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
