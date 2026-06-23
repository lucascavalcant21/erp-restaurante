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

