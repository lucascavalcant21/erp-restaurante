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

// Categorias de validade usadas na tela de etiquetas. Ficam dentro do JSON
// `config_sistema.params`, portanto são compartilhadas por toda a unidade.
export const VALIDADES_ETIQUETA_PADRAO = [
  { id: "resfriados", nome: "Resfriados", dias: 3 },
  { id: "congelados", nome: "Congelados", dias: 30 },
  { id: "ambiente", nome: "Temperatura ambiente", dias: 1 },
];

function normalizarValidades(lista) {
  if (!Array.isArray(lista)) return VALIDADES_ETIQUETA_PADRAO.map((item) => ({ ...item }));
  const usadas = new Set();
  const normalizadas = lista
    .map((item, indice) => {
      const nome = String(item?.nome || "").trim();
      const dias = Number(item?.dias);
      if (!nome || !Number.isFinite(dias) || dias < 0 || dias > 3650) return null;
      let id = String(item?.id || `validade-${indice + 1}`).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
      if (!id || usadas.has(id)) id = `validade-${indice + 1}-${Date.now()}`;
      usadas.add(id);
      return { id, nome, dias: Math.round(dias) };
    })
    .filter(Boolean);
  return normalizadas.length ? normalizadas : VALIDADES_ETIQUETA_PADRAO.map((item) => ({ ...item }));
}

async function fetchRegistroConfig(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return null;
  const { data, error } = await supabase.from("config_sistema")
    .select("id, params").eq("unidade_id", unidadeId).limit(1);
  if (error || !data?.length) return null;
  return data[0];
}

async function tentarMergeAtomico(unidadeId, patch) {
  try {
    const { data, error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId,
      p_patch: patch,
    });
    return error ? null : data;
  } catch {
    return null;
  }
}

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
  const mergeAtomico = await tentarMergeAtomico(unidadeId, params);
  if (mergeAtomico) return { error: undefined };
  const registro = await fetchRegistroConfig(unidadeId);
  const paramsMesclados = { ...(registro?.params || {}), ...params };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params: paramsMesclados }).eq("id", registro.id);
    return { error: error?.message };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params: paramsMesclados }]);
  return { error: error?.message };
}

// Designer da ficha de montagem. Fica no mesmo JSON de configurações da
// unidade, mas separado dos parâmetros numéricos para poder guardar opções
// visuais (fonte, cor, foto, campos exibidos etc.).
export async function fetchModeloMontagem(unidadeId) {
  const registro = await fetchRegistroConfig(unidadeId);
  const modelo = registro?.params?.modelo_montagem;
  return { data: modelo && typeof modelo === "object" ? modelo : null };
}

export async function salvarModeloMontagem(unidadeId, modelo) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco" };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade" };
  const patch = { modelo_montagem: modelo };
  const mergeAtomico = await tentarMergeAtomico(unidadeId, patch);
  if (mergeAtomico) return { error: undefined };
  const registro = await fetchRegistroConfig(unidadeId);
  const params = { ...(registro?.params || {}), ...patch };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { error: error?.message };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { error: error?.message };
}

export async function fetchValidadesEtiqueta(unidadeId) {
  const registro = await fetchRegistroConfig(unidadeId);
  return { data: normalizarValidades(registro?.params?.validade_categorias) };
}

export async function salvarValidadesEtiqueta(unidadeId, categorias) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const validade_categorias = normalizarValidades(categorias);
  const mergeAtomico = await tentarMergeAtomico(unidadeId, { validade_categorias });
  if (mergeAtomico) return { error: undefined, data: validade_categorias };
  const registro = await fetchRegistroConfig(unidadeId);
  const params = { ...(registro?.params || {}), validade_categorias };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { error: error?.message, data: validade_categorias };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { error: error?.message, data: validade_categorias };
}
