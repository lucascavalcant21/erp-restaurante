// Implantação: o que já está cadastrado (contagens reais do banco), os custos
// fixos e o perfil do negócio que o Jhon vai montando com as respostas do
// dono. Tudo pela sessão do dono (RLS da unidade).
import { supabase, isSupabaseReady } from "./supabase";
import { salvarParams } from "./parametros";
import { responder } from "./implantacao.mjs";

async function contar(tabela, filtro) {
  try {
    let q = supabase.from(tabela).select("id", { count: "exact", head: true });
    q = filtro(q);
    const { count, error } = await q;
    return error || count == null ? null : count;
  } catch {
    return null;
  }
}

async function paramsCrus(unidadeId) {
  const { data, error } = await supabase.from("config_sistema").select("params").eq("unidade_id", unidadeId).limit(1);
  return error ? null : data?.[0]?.params || {};
}

export async function carregarImplantacao(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return null;
  const u = String(unidadeId);
  const [unidadeR, params, colaboradoresComHorario, insumos, fichas, fichasBar, produtos, mesas] = await Promise.all([
    supabase.from("unidades").select("id, nome, nome_fantasia, endereco, cidade, uf, telefone_unidade, telefone_contato").eq("id", u).maybeSingle(),
    paramsCrus(u),
    contar("colaboradores", (q) => q.eq("unidade_id", u).eq("status", "ativo").not("horario_entrada", "is", null)),
    contar("insumos", (q) => q.eq("unidade_id", u)),
    contar("fichas_tecnicas", (q) => q.eq("unidade_id", u).eq("ativo", true)),
    contar("fichas_tecnicas", (q) => q.eq("unidade_id", u).eq("ativo", true).eq("departamento", "bar")),
    contar("produtos", (q) => q.eq("unidade_id", u).eq("ativo", true)),
    contar("mesas", (q) => q.eq("unidade_id", u)),
  ]);
  return {
    unidade: unidadeR?.error ? null : unidadeR?.data || null,
    params: params || {},
    paramsLidos: params !== null,
    perfil: params?.perfil_negocio || {},
    contagens: { colaboradoresComHorario, insumos, fichas, fichasBar, produtos, mesas },
  };
}

/** Grava uma resposta do dono no perfil do negócio (lê o atual antes: não apaga as outras). */
export async function salvarResposta(unidadeId, id, valor) {
  const atual = (await paramsCrus(String(unidadeId)))?.perfil_negocio || {};
  const perfil = responder(atual, id, valor);
  const r = await salvarParams(unidadeId, { perfil_negocio: perfil });
  return { error: r?.error || null, perfil };
}

/** Custos fixos do mês informados na implantação (mesmas chaves da Pizza do Lucro). */
export async function salvarCustosFixos(unidadeId, valores) {
  const limpos = Object.fromEntries(Object.entries(valores || {}).map(([k, v]) => [k, Math.max(0, Number(String(v).replace(/\./g, "").replace(",", ".")) || 0)]));
  const r = await salvarParams(unidadeId, limpos);
  return { error: r?.error || null };
}
