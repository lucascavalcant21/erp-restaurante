import { supabase, isSupabaseReady } from "./supabase";

// Parâmetros ajustáveis do sistema (Configurações > Parâmetros). Sem registro
// no banco (ou sem a tabela), valem os padrões — nada quebra.
export const PARAMS_PADRAO = {
  // Ponto
  tolerancia_entrada: 2,   // min antes do turno em que a entrada libera
  tolerancia_marcacao: 5,  // min de tolerância na entrada/saída (Súmula 366)
  tolerancia_retorno: 2,   // min de tolerância na volta do intervalo
  limite_atraso: 60,       // min de atraso que viram falta (bloqueia a batida)
  lembrete_min: 10,        // antecedência dos lembretes de WhatsApp
  // RH / Consumo
  desconto_func_pct: 30,   // % de desconto do funcionário no consumo/vales
  // Financeiro
  meta_cmv: 30,            // % alvo máximo de CMV
  faturamento_minimo_cmo: 1000, // piso de entradas p/ exibir o CMO %
  // Estoque
  fator_reposicao: 2,      // lista de compras repõe até (fator × mínimo)
};

export async function fetchParams(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: { ...PARAMS_PADRAO } };
  try {
    const { data, error } = await supabase.from("config_sistema")
      .select("params").eq("unidade_id", unidadeId).limit(1);
    if (error || !data || !data.length || !data[0].params) return { data: { ...PARAMS_PADRAO } };
    const salvos = data[0].params;
    const merged = { ...PARAMS_PADRAO };
    Object.keys(PARAMS_PADRAO).forEach(k => {
      const v = Number(salvos[k]);
      if (Number.isFinite(v) && v >= 0) merged[k] = v;
    });
    return { data: merged };
  } catch {
    return { data: { ...PARAMS_PADRAO } };
  }
}

export async function salvarParams(unidadeId, params) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data: exist } = await supabase.from("config_sistema")
    .select("id").eq("unidade_id", unidadeId).limit(1);
  if (exist && exist.length) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", exist[0].id);
    return { error: error?.message };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { error: error?.message };
}
