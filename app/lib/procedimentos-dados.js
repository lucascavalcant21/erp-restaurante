// Procedimentos da casa: leitura e gravação pela sessão de quem edita (RLS por unidade).
// Reaproveita a Operação Inteligente (op_processos/op_secoes/op_itens).
// Fotos, vídeos e detalhes de cada passo vão na coluna `conteudo`
// (migração OP-CONTEUDO-1). Sem ela, o procedimento continua só com texto.
import { supabase, isSupabaseReady } from "./supabase";
import { salvarProcesso, salvarEstrutura, arquivarProcesso } from "./operacao-inteligente";
import { CATEGORIA, montarProcedimentos, paraEstrutura, precisaDeConteudo } from "./procedimentos.mjs";

let temConteudoCache = null;
const semColuna = (e) => /conteudo/i.test(e?.message || "") && /column|coluna|schema cache/i.test(e?.message || "");

/** O banco já tem a coluna conteudo? (lembra a resposta na sessão) */
export async function bancoTemConteudo() {
  if (temConteudoCache !== null) return temConteudoCache;
  if (!isSupabaseReady()) return false;
  const { error } = await supabase.from("op_itens").select("conteudo").limit(1);
  temConteudoCache = !error;
  return temConteudoCache;
}

export async function listarProcedimentos(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  const comConteudo = await bancoTemConteudo();
  const extra = comConteudo ? ", conteudo" : "";
  const { data: procs, error } = await supabase.from("op_processos").select(`id, nome, descricao, setor, updated_at${extra}`)
    .eq("unidade_id", String(unidadeId)).eq("categoria", CATEGORIA).eq("arquivado", false).order("nome");
  if (error) return { data: [], error: error.message };
  if (!procs?.length) return { data: [], comConteudo };
  const ids = procs.map((p) => p.id);
  const [{ data: secoes }, { data: itens }] = await Promise.all([
    supabase.from("op_secoes").select("id, processo_id, titulo, ordem").in("processo_id", ids),
    supabase.from("op_itens").select(`id, processo_id, secao_id, titulo, ordem${extra}`).in("processo_id", ids),
  ]);
  return { data: montarProcedimentos(procs, secoes, itens), comConteudo };
}

export async function salvarProcedimento(unidadeId, proc) {
  const comConteudo = await bancoTemConteudo();
  if (!comConteudo && precisaDeConteudo(proc)) {
    return { error: "Fotos, vídeos, produto e tipo de procedimento precisam da migração OP-CONTEUDO-1 neste banco. Salve só o texto ou aplique a migração." };
  }
  const { processo, secoes } = paraEstrutura(proc, unidadeId, { comConteudo });
  const r = await salvarProcesso(processo);
  if (r.error || !r.id) return { error: semColuna({ message: r.error }) ? "Falta a migração OP-CONTEUDO-1." : r.error || "Não consegui salvar." };
  const e = await salvarEstrutura(r.id, secoes);
  return { id: r.id, error: e.error || null };
}

export async function arquivarProcedimento(id) {
  return arquivarProcesso(id, true);
}

const MB = 1024 * 1024;
// Vídeo curto de celular. Maior que isso: suba no YouTube (não listado) e cole o link.
export const LIMITE_VIDEO_MB = 50;

/** Envia foto ou vídeo do procedimento para o bucket de material de ensino. */
export async function enviarMidiaProcedimento(unidadeId, arquivo) {
  if (!isSupabaseReady() || !arquivo) return { error: "Escolha o arquivo." };
  const video = String(arquivo.type || "").startsWith("video/");
  const foto = String(arquivo.type || "").startsWith("image/");
  if (!video && !foto) return { error: "Mande uma foto ou um vídeo." };
  if (arquivo.size > (video ? LIMITE_VIDEO_MB : 10) * MB) {
    return { error: video ? `Vídeo acima de ${LIMITE_VIDEO_MB} MB. Corte o vídeo ou cole o link do YouTube.` : "Foto acima de 10 MB." };
  }
  const ext = (String(arquivo.name || "").split(".").pop() || (video ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const caminho = `procedimentos/${unidadeId}/${id}.${ext}`;
  const { error } = await supabase.storage.from("anexos").upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
  if (error) return { error: "Não consegui enviar o arquivo. Tente de novo." };
  const { data } = supabase.storage.from("anexos").getPublicUrl(caminho);
  return { error: null, midia: { tipo: video ? "video" : "foto", url: data?.publicUrl || "" } };
}
