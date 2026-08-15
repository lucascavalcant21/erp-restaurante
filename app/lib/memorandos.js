import { supabase, isSupabaseReady } from "./supabase";

export async function fetchMemorandoOperacao(unidadeId, dataReferencia) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase
    .from("memorandos_operacao")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("data_referencia", dataReferencia)
    .maybeSingle();
  return { data: data || null, error: error?.message || null };
}

export async function salvarMemorandoOperacao(unidadeId, memorando) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const payload = {
    unidade_id: unidadeId,
    data_referencia: memorando.dataReferencia,
    cozinha: memorando.cozinha || {},
    bar: memorando.bar || {},
    compras_manuais: memorando.comprasManuais || [],
    observacoes: memorando.observacoes || null,
    status: memorando.status || "rascunho",
    criado_por: memorando.criadoPor || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("memorandos_operacao")
    .upsert(payload, { onConflict: "unidade_id,data_referencia" })
    .select()
    .single();
  return { data: data || null, error: error?.message || null };
}
