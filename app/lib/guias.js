import { supabase, isSupabaseReady } from "./supabase";

// GUIAS OPERACIONAIS — funções, produtos e equipamentos.
//
// Material de treino é consultado no tablet da cozinha, no celular do garçom e
// no computador da gerência. Por isso vive no banco: guardado em cada aparelho,
// cada um teria a sua versão, e a versão errada é pior que nenhuma porque
// ninguém desconfia dela.

export const TIPOS_GUIA = { FUNCAO: "funcao", PRODUTO: "produto", EQUIPAMENTO: "equipamento" };

// A migração pode não ter rodado ainda. Nesse caso a tela precisa dizer isso em
// vez de mostrar uma lista vazia como se a loja não tivesse guia nenhum.
const tabelaAusente = (erro) => {
  const texto = `${erro?.message || ""} ${erro?.details || ""}`.toLowerCase();
  return erro?.code === "42P01" || texto.includes("guias_operacionais") && texto.includes("does not exist");
};

export async function fetchGuias(unidadeId, tipo) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };
  let query = supabase.from("guias_operacionais")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .order("ordem")
    .order("titulo");
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return { data: [], error: tabelaAusente(error) ? "sem_tabela" : error.message };
  return { data: data || [], error: null };
}

export async function salvarGuia(guia) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const unidade = String(guia?.unidade_id || "").trim();
  if (!unidade) return { error: "Escolha a loja no topo da tela antes de salvar." };

  const campos = {
    unidade_id: unidade,
    tipo: guia.tipo,
    titulo: String(guia.titulo || "").trim() || "Sem título",
    setor: guia.setor || null,
    cor: guia.cor || null,
    conteudo: guia.conteudo ?? [],
    observacoes: guia.observacoes || null,
    ordem: Number(guia.ordem) || 0,
  };

  if (guia.id) {
    const { error } = await supabase.from("guias_operacionais").update(campos).eq("id", guia.id);
    return { id: guia.id, error: error ? (tabelaAusente(error) ? "sem_tabela" : error.message) : null };
  }
  const { data, error } = await supabase.from("guias_operacionais").insert([campos]).select("id").single();
  return { id: data?.id || null, error: error ? (tabelaAusente(error) ? "sem_tabela" : error.message) : null };
}

// Exclusão de verdade: um guia arquivado que continua aparecendo em consulta
// futura confunde mais do que ajuda. Quem apagou, apagou.
export async function removerGuia(id) {
  if (!isSupabaseReady() || !id) return { error: null };
  const { error } = await supabase.from("guias_operacionais").delete().eq("id", id);
  return { error: error ? (tabelaAusente(error) ? "sem_tabela" : error.message) : null };
}

// Semeia a loja com um modelo na primeira abertura. Sem isto a tela estreia
// vazia, e uma tela vazia não ensina o que ela deveria conter.
export async function semearGuias(unidadeId, modelos, tipo) {
  if (!isSupabaseReady() || !unidadeId || !modelos?.length) return { data: [], error: null };
  const linhas = modelos.map((modelo, indice) => ({
    unidade_id: unidadeId,
    tipo,
    titulo: modelo.titulo,
    setor: modelo.setor || null,
    cor: modelo.cor || null,
    conteudo: modelo.conteudo ?? [],
    observacoes: modelo.observacoes || null,
    ordem: indice,
  }));
  const { data, error } = await supabase.from("guias_operacionais").insert(linhas).select("*");
  if (error) return { data: [], error: tabelaAusente(error) ? "sem_tabela" : error.message };
  return { data: data || [], error: null };
}
