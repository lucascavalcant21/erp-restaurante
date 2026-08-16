import { supabase, isSupabaseReady } from "./supabase";

// CUSTOS FIXOS DO MÊS — a conta mais simples que existe:
// tudo que sai todo mês, dividido pelos dias do mês, mais a folha fixa.
// A lista fica em config_sistema.params.custos_fixos: é uma lista curta de
// nome + valor, não precisa de tabela nova.

export function diasNoMes(referencia = new Date()) {
  const d = new Date(referencia);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export const porDia = (valorMensal, dias) => (Number(valorMensal) || 0) / (dias || 30);

// Folha fixa: só quem é contratado. Extra/freelancer entra por diária, não é
// custo fixo do mês.
export function folhaFixa(colaboradores = []) {
  return (colaboradores || [])
    .filter(c => c && (c.status || "ativo") !== "inativo" && String(c.tipo_contrato || "") !== "Freelancer")
    .reduce((soma, c) => soma + (Number(c.salario) || 0), 0);
}

export function totalMensal(custos = [], folha = 0, { incluirFolha = true } = {}) {
  const dos = (custos || []).reduce((s, c) => s + (Number(c.valor) || 0), 0);
  return dos + (incluirFolha ? Number(folha) || 0 : 0);
}

function normalizar(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((c, i) => ({
      id: c.id || `c${i + 1}`,
      nome: String(c.nome || "").trim(),
      valor: Number(c.valor) || 0,
    }))
    .filter(c => c.nome);
}

export async function fetchCustosFixos(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { data: [], incluirFolha: true };
  }
  const { data, error } = await supabase.from("config_sistema")
    .select("params").eq("unidade_id", unidadeId).limit(1);
  const bloco = data?.[0]?.params?.custos_fixos;
  return {
    data: normalizar(bloco?.lista),
    incluirFolha: bloco?.incluir_folha !== false,
    error: error?.message || null,
  };
}

export async function salvarCustosFixos(unidadeId, lista, { incluirFolha = true } = {}) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade específica." };
  const custos_fixos = { lista: normalizar(lista), incluir_folha: !!incluirFolha };

  try {
    const { error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId, p_patch: { custos_fixos },
    });
    if (!error) return { data: custos_fixos.lista, error: null };
  } catch { /* segue pelo caminho direto */ }

  const { data: registros, error: erroLeitura } = await supabase
    .from("config_sistema").select("id, params").eq("unidade_id", unidadeId).limit(1);
  if (erroLeitura) return { error: erroLeitura.message };

  const registro = registros?.[0];
  const params = { ...(registro?.params || {}), custos_fixos };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { data: custos_fixos.lista, error: error?.message || null };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { data: custos_fixos.lista, error: error?.message || null };
}
