import { supabase, isSupabaseReady } from "./supabase";

const MARCADOR = "\n[[HEFISTO_TREINAMENTO:";
const normalizar = item => {
  const descricao = String(item?.descricao || "");
  const inicio = descricao.lastIndexOf(MARCADOR);
  if (inicio < 0) return { ...item, departamento: item?.departamento || "salao", modulo: item?.modulo || "Geral", conteudo_texto: item?.conteudo_texto || descricao, duracao_minutos: Number(item?.duracao_minutos) || 5, obrigatorio: Boolean(item?.obrigatorio) };
  try {
    const meta = JSON.parse(descricao.slice(inicio + MARCADOR.length, descricao.length - 2));
    return { ...item, ...meta, descricao: descricao.slice(0, inicio), conteudo_texto: meta.conteudo_texto || descricao.slice(0, inicio) };
  } catch { return { ...item, departamento: "salao", modulo: "Geral", conteudo_texto: descricao }; }
};

export async function fetchTreinamentos(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  let query = supabase.from("treinamentos").select("*").order("created_at", { ascending: false });
  if (unidadeId && unidadeId !== "todas") {
    query = query.eq("unidade_id", unidadeId);
  }
  const { data, error } = await query;
  return { data: (data || []).map(normalizar), error: error?.message };
}

export async function inserirTreinamento(t) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { departamento = "salao", modulo = "Geral", conteudo_texto = "", duracao_minutos = 5, obrigatorio = false, ...base } = t;
  let resposta = await supabase.from("treinamentos").insert([{ ...base, departamento, modulo, conteudo_texto, duracao_minutos, obrigatorio }]).select("id").single();
  if (resposta.error && /departamento|modulo|conteudo_texto|duracao_minutos|obrigatorio|column|schema cache/i.test(resposta.error.message || "")) {
    const meta = { departamento, modulo, conteudo_texto, duracao_minutos: Number(duracao_minutos) || 5, obrigatorio: Boolean(obrigatorio) };
    resposta = await supabase.from("treinamentos").insert([{ ...base, descricao: `${base.descricao || conteudo_texto}${MARCADOR}${JSON.stringify(meta)}]]` }]).select("id").single();
  }
  return { data: resposta.data, error: resposta.error?.message };
}

export async function fetchTreinamento(id) {
  if (!isSupabaseReady() || !id) return { data: null, error: "Treinamento inválido" };
  const { data, error } = await supabase.from("treinamentos").select("*").eq("id", id).maybeSingle();
  return { data: data ? normalizar(data) : null, error: error?.message };
}

export async function uploadMidiaTreinamento({ unidadeId, arquivo, tipo = "arquivo" }) {
  if (!isSupabaseReady() || !arquivo) return { data: null, error: "Arquivo inválido" };
  const extensao = String(arquivo.name || "arquivo").split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const caminho = `treinamentos/${unidadeId || "geral"}/${tipo}/${id}.${extensao}`;
  const { error } = await supabase.storage.from("anexos").upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
  if (error) return { data: null, error: error.message };
  const { data } = supabase.storage.from("anexos").getPublicUrl(caminho);
  return { data: data?.publicUrl || null, error: null };
}

export async function removerTreinamento(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("treinamentos").delete().eq("id", id);
  return { error: error?.message };
}
