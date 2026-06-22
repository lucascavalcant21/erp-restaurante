import { supabase, isSupabaseReady } from "./supabase";

// Busca os pontos de hoje para os colaboradores da unidade
export async function fetchPontoHoje(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  
  const hoje = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  
  let query = supabase.from("registro_ponto").select("*").eq("data_referencia", hoje);
  if (unidadeId && unidadeId !== "matriz") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

// Bate o ponto (Registra a transição de estado na mesma linha do dia)
export async function baterPonto(unidadeId, colabId, novoStatus, colunaHora) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const hoje = new Date().toISOString().split("T")[0];
  const agora = new Date().toISOString();

  // Tenta encontrar o registro de hoje
  const { data: existente } = await supabase
    .from("registro_ponto")
    .select("id")
    .eq("colaborador_id", colabId)
    .eq("data_referencia", hoje)
    .single();

  if (existente) {
    // Atualiza o registro existente com a nova hora e status
    const { error } = await supabase
      .from("registro_ponto")
      .update({ 
         [colunaHora]: agora, 
         status_jornada: novoStatus 
      })
      .eq("id", existente.id);
    return { error: error?.message };
  } else {
    // Insere o primeiro registro do dia (Entrada)
    const { error } = await supabase
      .from("registro_ponto")
      .insert([{
         colaborador_id: colabId,
         unidade_id: unidadeId,
         data_referencia: hoje,
         [colunaHora]: agora,
         status_jornada: novoStatus
      }]);
    return { error: error?.message };
  }
}
