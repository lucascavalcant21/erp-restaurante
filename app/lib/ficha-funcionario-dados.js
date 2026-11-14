// Ficha do funcionário: leitura e gravação pela sessão de quem usa (RLS do
// banco por permissão de RH na unidade). A unidade nunca vai no corpo: o
// gatilho do banco põe a do funcionário. Arquivo assinado vai para o bucket
// privado rh-docs pelo servidor (rh-arquivos), nunca para o bucket público.
import { supabase, isSupabaseReady } from "./supabase";
import { fetchDocumentos, fetchAdvertenciasColab } from "./rh";
import { fetchAtas } from "./pessoas";
import { enviarArquivoRH } from "./rh-arquivos";

const TABELA = "rh_registros_colab";
const semTabela = (e) => /rh_registros_colab|relation .* does not exist|schema cache/i.test(e?.message || "");

export async function carregarFicha(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { registros: [], legado: {}, erro: "Sem conexão com o banco." };
  const [reg, adv, docs, atas] = await Promise.all([
    supabase.from(TABELA).select("*").eq("colaborador_id", colaboradorId).order("data", { ascending: false }).order("created_at", { ascending: false }),
    fetchAdvertenciasColab(colaboradorId).catch(() => ({ data: [] })),
    fetchDocumentos(colaboradorId).catch(() => ({ data: [] })),
    fetchAtas(colaboradorId).catch(() => []),
  ]);
  return {
    registros: reg.error ? [] : reg.data || [],
    // Sem a migração RH-FICHA-1 a ficha só mostra o que já existia.
    semMigracao: reg.error ? semTabela(reg.error) : false,
    erro: reg.error && !semTabela(reg.error) ? reg.error.message : null,
    legado: {
      advertenciasAntigas: adv?.data || [],
      documentos: docs?.data || [],
      atas: Array.isArray(atas) ? atas : atas?.data || [],
    },
  };
}

/** Grava o registro e, se veio, a cópia assinada. */
export async function registrarNaFicha(registro, { arquivo = null } = {}) {
  if (!isSupabaseReady()) return { error: "Sem conexão com o banco." };
  const { data, error } = await supabase.from(TABELA).insert([registro]).select("*").single();
  if (error) {
    return { error: semTabela(error) ? "A ficha ainda não existe neste banco (migração RH-FICHA-1)." : error.message };
  }
  if (arquivo) {
    const r = await anexarAssinado(data, arquivo);
    if (r.error) return { data, error: `Registro salvo, mas o arquivo não subiu: ${r.error}` };
    return { data: r.data, error: null };
  }
  return { data, error: null };
}

/** Anexa a foto ou o PDF do documento assinado pelo funcionário. */
export async function anexarAssinado(registro, arquivo) {
  const up = await enviarArquivoRH({ fonte: "registro_colab", arquivo, donoId: registro.colaborador_id });
  if (up.error) return { error: up.error };
  const { data, error } = await supabase.from(TABELA)
    .update({ arquivo_url: up.ref, assinado: true })
    .eq("id", registro.id).select("*").single();
  return { data, error: error?.message || null };
}

/** Funcionário se recusou a assinar: vale com duas testemunhas. */
export async function registrarRecusa(id, testemunhas) {
  const { data, error } = await supabase.from(TABELA)
    .update({ recusou_assinar: true, testemunhas: String(testemunhas || "").trim() })
    .eq("id", id).select("*").single();
  return { data, error: error?.message || null };
}

export async function marcarDevolvido(id, dataIso) {
  const { data, error } = await supabase.from(TABELA).update({ devolvido_em: dataIso }).eq("id", id).select("*").single();
  return { data, error: error?.message || null };
}

export async function anularRegistro(id, motivo) {
  const { data, error } = await supabase.from(TABELA)
    .update({ anulado_em: new Date().toISOString(), anulado_motivo: String(motivo || "").trim() })
    .eq("id", id).select("*").single();
  return { data, error: error?.message || null };
}
