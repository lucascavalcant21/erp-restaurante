// Acesso ao banco do consultório (CONS-1). As regras de quem vê o quê estão no
// banco (RLS): a ficha só o médico que escreveu; o gerente do restaurante não
// vê pacientes. Aqui só leitura e gravação.

import { supabase, isSupabaseReady } from "../supabase";
import { mensagemErro } from "../marmitaria/dados";
import { salvarParams } from "../parametros";
import { UNIDADE_CONSULTORIO } from "./agenda.mjs";
import { normalizarConfig } from "./precificacao.mjs";

const U = UNIDADE_CONSULTORIO;
const SEM_BANCO = "Sem conexão com o banco. O que você preencheu continua na tela: tente de novo.";
const erro = (e) => (e ? mensagemErro(e) : null);
const pronto = () => isSupabaseReady();

export async function temAcesso() {
  if (!pronto()) return { data: false, error: SEM_BANCO };
  const { data, error } = await supabase.rpc("cons_pode_acessar", { p_unidade_id: U });
  if (error && /cons_pode_acessar|function|does not exist/i.test(error.message || "")) return { data: false, error: "O banco ainda não tem o consultório (CONS-1)." };
  return { data: !!data, error: erro(error) };
}

export async function fetchBase() {
  if (!pronto()) return { tipos: [], convenios: [], config: normalizarConfig({}), error: SEM_BANCO };
  const [t, c, p] = await Promise.all([
    supabase.from("cons_tipos_consulta").select("*").eq("unidade_id", U).order("ordem").order("nome"),
    supabase.from("cons_convenios").select("*").eq("unidade_id", U).order("nome"),
    supabase.from("config_sistema").select("params").eq("unidade_id", U).limit(1),
  ]);
  return {
    tipos: t.data || [], convenios: c.data || [],
    config: normalizarConfig(p.data?.[0]?.params?.consultorio_custos || {}),
    error: [t.error, c.error, p.error].filter(Boolean).map(erro).join(" · ") || null,
  };
}

export const salvarConfig = (cfg) => salvarParams(U, { consultorio_custos: normalizarConfig(cfg) });

async function gravar(tabela, linha) {
  if (!pronto()) return { data: null, error: SEM_BANCO };
  const { id, ...resto } = linha;
  const q = id
    ? supabase.from(tabela).update(resto).eq("id", id).eq("unidade_id", U).select("*")
    : supabase.from(tabela).insert({ ...resto, unidade_id: U }).select("*");
  const { data, error } = await q;
  return { data: data?.[0] || null, error: erro(error) };
}

export const salvarTipo = (t) => gravar("cons_tipos_consulta", t);
export const salvarConvenio = (c) => gravar("cons_convenios", c);
export const salvarPaciente = (p) => gravar("cons_pacientes", p);
export const salvarConsulta = (c) => gravar("cons_consultas", c);

export async function buscarPacientes(termo = "", limite = 30) {
  if (!pronto()) return { data: [], error: SEM_BANCO };
  let q = supabase.from("cons_pacientes").select("*").eq("unidade_id", U).eq("ativo", true).order("nome").limit(limite);
  const t = String(termo || "").trim();
  if (t) {
    const dig = t.replace(/\D/g, "");
    q = dig.length >= 3 ? q.or(`cpf.ilike.%${dig}%,telefone.ilike.%${dig}%`) : q.ilike("nome", `%${t.replace(/[%,()]/g, " ")}%`);
  }
  const { data, error } = await q;
  return { data: data || [], error: erro(error) };
}

export async function fetchPacientesPorId(ids = []) {
  if (!pronto() || !ids.length) return { data: [], error: null };
  const { data, error } = await supabase.from("cons_pacientes").select("*").in("id", [...new Set(ids)]);
  return { data: data || [], error: erro(error) };
}

export async function fetchConsultas(deIso, ateIso) {
  if (!pronto()) return { data: [], error: SEM_BANCO };
  const { data, error } = await supabase.from("cons_consultas").select("*").eq("unidade_id", U)
    .gte("inicio", deIso).lt("inicio", ateIso).order("inicio");
  return { data: data || [], error: erro(error) };
}

export async function fetchConsultasDoPaciente(pacienteId) {
  if (!pronto()) return { data: [], error: SEM_BANCO };
  const { data, error } = await supabase.from("cons_consultas").select("*").eq("paciente_id", pacienteId).order("inicio", { ascending: false }).limit(100);
  return { data: data || [], error: erro(error) };
}

/** Consultas futuras (para saber quem já tem retorno marcado). */
export async function fetchConsultasDesde(deIso) {
  if (!pronto()) return { data: [], error: SEM_BANCO };
  const { data, error } = await supabase.from("cons_consultas").select("id, paciente_id, inicio, status").eq("unidade_id", U).gte("inicio", deIso).limit(2000);
  return { data: data || [], error: erro(error) };
}

/** Fichas do paciente (só as do médico logado). A leitura fica registrada. */
export async function fichasDoPaciente(pacienteId) {
  if (!pronto()) return { data: [], error: SEM_BANCO };
  const { data, error } = await supabase.rpc("cons_fichas_do_paciente", { p_paciente_id: pacienteId });
  return { data: data || [], error: erro(error) };
}

/** Só datas de retorno (sem conteúdo clínico), para a lista de retornos esquecidos. */
export async function fetchRetornos() {
  if (!pronto()) return { data: [], error: SEM_BANCO };
  const { data, error } = await supabase.from("cons_fichas").select("paciente_id, criado_em, retorno_dias").eq("unidade_id", U).gt("retorno_dias", 0).limit(5000);
  return { data: data || [], error: erro(error) };
}

export async function salvarFicha(ficha) {
  if (!pronto()) return { data: null, error: SEM_BANCO };
  const { id, ...resto } = ficha;
  const q = id
    ? supabase.from("cons_fichas").update(resto).eq("id", id).select("*")
    : supabase.from("cons_fichas").insert({ ...resto, unidade_id: U }).select("*");
  const { data, error } = await q;
  return { data: data?.[0] || null, error: erro(error) };
}

// ─── Teleconsulta (CONS-2) ───────────────────────────────────────────────────

export async function fetchTeleconsultas(consultaIds = []) {
  if (!pronto() || !consultaIds.length) return { data: [], error: null };
  const [t, c] = await Promise.all([
    supabase.from("cons_teleconsultas").select("*").in("consulta_id", consultaIds),
    supabase.from("cons_consentimentos").select("consulta_id, aceito_em, termo_versao").in("consulta_id", consultaIds),
  ]);
  const aceites = new Map((c.data || []).map((x) => [x.consulta_id, x]));
  return { data: (t.data || []).map((x) => ({ ...x, aceite: aceites.get(x.consulta_id) || null })), error: erro(t.error || c.error) };
}

/** Cria a sala pelo servidor (Whereby). semChave: a chave não está configurada. */
export async function criarSala(consultaId, termo) {
  const { fetchComSessao } = await import("../api-sessao");
  try {
    const r = await fetchComSessao("/api/consultorio/sala", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consulta_id: consultaId, termo_versao: termo.versao, termo_texto: termo.texto }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { data: null, error: j.error || "Não consegui criar a sala.", semChave: !!j.semChave };
    return { data: j.teleconsulta, error: null };
  } catch { return { data: null, error: SEM_BANCO }; }
}

/** Sala colada à mão (sem a chave do Whereby): guarda o link e gera o convite. */
export async function salvarSalaManual({ consultaId, salaUrl, codigo, termo, existente = false }) {
  if (!pronto()) return { data: null, error: SEM_BANCO };
  const linha = { sala_url: salaUrl, sala_medico_url: salaUrl, provedor: /whereby\.com/i.test(salaUrl) ? "whereby" : "link", termo_versao: termo.versao, termo_texto: termo.texto };
  const q = existente
    ? supabase.from("cons_teleconsultas").update(linha).eq("consulta_id", consultaId).select("*")
    : supabase.from("cons_teleconsultas").insert({ ...linha, consulta_id: consultaId, unidade_id: U, codigo }).select("*");
  const { data, error } = await q;
  if (!error) await supabase.from("cons_consultas").update({ modalidade: "teleconsulta" }).eq("id", consultaId);
  return { data: data?.[0] || null, error: erro(error) };
}
