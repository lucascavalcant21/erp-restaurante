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
  // Custos operacionais do mês (para o Ponto de Equilíbrio e a "pizza" do prato)
  custo_aluguel_mes: 0,
  custo_luz_mes: 0,        // energia elétrica
  custo_gas_mes: 0,
  custo_agua_mes: 0,
  custo_limpeza_mes: 0,    // produtos de limpeza
  custo_cmo_mes: 0,        // folha (mão de obra) do mês
  custo_outros_mes: 0,
  imposto_pct: 0,          // % de imposto sobre a venda
  embalagem_pct: 0,        // % de embalagem sobre a venda
  dias_operacao_mes: 26,   // dias que a loja abre no mês
  pratos_por_dia: 100,     // média de pratos vendidos por dia (rateio dos fixos)
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

// Categorias personalizadas das fichas técnicas, compartilhadas entre todos os
// aparelhos da unidade. Mantém também as categorias padrão que o usuário optou
// por ocultar, sem alterar as fichas já cadastradas.
export async function fetchCategoriasFichas(unidadeId) {
  const registro = await fetchRegistroConfig(unidadeId);
  const config = registro?.params?.categorias_fichas;
  return { data: config && typeof config === "object" ? config : {} };
}

export async function salvarCategoriasFichas(unidadeId, categorias_fichas) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco" };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade" };
  const patch = { categorias_fichas };
  const mergeAtomico = await tentarMergeAtomico(unidadeId, patch);
  if (mergeAtomico) return { error: undefined, data: categorias_fichas };
  const registro = await fetchRegistroConfig(unidadeId);
  const params = { ...(registro?.params || {}), ...patch };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { error: error?.message, data: categorias_fichas };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { error: error?.message, data: categorias_fichas };
}

// Fotos REAIS dos copos do bar (tiradas pelo usuário): { idCopo: url }.
// A foto vale para todos os drinks que usam aquele copo — substitui o desenho
// no Guia de Drinks.
export async function fetchFotosCopos(unidadeId) {
  const registro = await fetchRegistroConfig(unidadeId);
  const fotos = registro?.params?.fotos_copos;
  return { data: fotos && typeof fotos === "object" ? fotos : {} };
}

export async function salvarFotoCopo(unidadeId, idCopo, url) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade" };
  const registro = await fetchRegistroConfig(unidadeId);
  const fotos_copos = { ...(registro?.params?.fotos_copos || {}) };
  if (url) fotos_copos[idCopo] = url; else delete fotos_copos[idCopo];
  const mergeAtomico = await tentarMergeAtomico(unidadeId, { fotos_copos });
  if (mergeAtomico) return { error: undefined, data: fotos_copos };
  const params = { ...(registro?.params || {}), fotos_copos };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { error: error?.message, data: fotos_copos };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { error: error?.message, data: fotos_copos };
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
