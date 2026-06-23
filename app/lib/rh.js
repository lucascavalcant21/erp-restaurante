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
export async function atualizarFuncionario(id, dados) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("colaboradores").update(dados).eq("id", id).select().single();
  return { data, error: error?.message };
}

export async function fetchPontoMes(unidadeId, mesAno) { return { data: [], error: null }; }
export async function registrarPonto(dados) { return { data: null, error: null }; }
