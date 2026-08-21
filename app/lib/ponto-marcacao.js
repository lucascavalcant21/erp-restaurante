import { supabase, isSupabaseReady } from "./supabase";

// Livro de marcações do ponto — o registro que vale para a fiscalização.
//
// registro_ponto guarda o resumo do dia e é o que as telas leem. Aqui fica uma
// linha por marcação, com NSR sequencial e encadeada por hash: é esta tabela
// que a Portaria MTP 671/2021 exige (arts. 80 e 81), porque é ela que prova que
// nenhuma batida foi apagada ou reescrita.
//
// Nada aqui atualiza ou apaga: o banco recusa por gatilho. Corrigir é inserir
// um 'ajuste' apontando para o valor anterior.

export const TIPOS_MARCACAO = ["entrada", "saida_intervalo", "retorno_intervalo", "saida_trabalho"];

export const ROTULO_MARCACAO = {
  entrada: "Entrada",
  saida_intervalo: "Saída para intervalo",
  retorno_intervalo: "Volta do intervalo",
  saida_trabalho: "Saída do trabalho",
  ajuste: "Ajuste",
};

// A tabela pode ainda não existir (migração não rodada). Nesse caso o ponto tem
// de continuar funcionando — mas quem chamou precisa saber que o registro legal
// não foi gravado, e não descobrir isso numa fiscalização.
function tabelaAusente(erro) {
  const msg = String(erro?.message || "");
  return /ponto_marcacao/i.test(msg) && /(does not exist|schema cache|relation)/i.test(msg);
}

export async function registrarMarcacao({
  unidadeId, colaboradorId, tipo, marcadoEm, dataReferencia,
  origem = "tablet", latitude = null, longitude = null,
  valorAnterior = null, tipoAlvo = null, registradoPor = null, motivo = null,
}) {
  if (!isSupabaseReady()) return { erro: "Offline", pendente: true };
  if (!unidadeId || !colaboradorId || !tipo || !marcadoEm || !dataReferencia) {
    return { erro: "Marcação incompleta", pendente: true };
  }

  const { data, error } = await supabase
    .from("ponto_marcacao")
    .insert([{
      unidade_id: unidadeId,
      colaborador_id: colaboradorId,
      tipo,
      marcado_em: marcadoEm,
      data_referencia: dataReferencia,
      origem,
      latitude, longitude,
      valor_anterior: valorAnterior,
      tipo_alvo: tipoAlvo,
      registrado_por: registradoPor,
      motivo,
    }])
    .select("nsr, marcado_em, hash")
    .single();

  if (error) {
    return {
      erro: error.message,
      pendente: true,
      semTabela: tabelaAusente(error),
    };
  }
  return { nsr: data?.nsr ?? null, marcadoEm: data?.marcado_em ?? marcadoEm, hash: data?.hash ?? null };
}

// Registra a correção de uma batida SEM apagar a original.
export async function registrarAjuste({
  unidadeId, colaboradorId, dataReferencia, tipoAlvo,
  valorAnterior, valorNovo, registradoPor, motivo,
}) {
  return registrarMarcacao({
    unidadeId, colaboradorId, dataReferencia,
    tipo: "ajuste",
    tipoAlvo,
    marcadoEm: valorNovo,
    valorAnterior,
    origem: "ajuste",
    registradoPor,
    motivo,
  });
}

export async function fetchMarcacoesDoDia(colaboradorId, dataISO) {
  if (!isSupabaseReady() || !colaboradorId || !dataISO) return { data: [] };
  const { data, error } = await supabase
    .from("ponto_marcacao")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .eq("data_referencia", String(dataISO).slice(0, 10))
    .order("nsr");
  return { data: data || [], error: error?.message };
}

export async function fetchMarcacoesMes(colaboradorId, anoMes) {
  if (!isSupabaseReady() || !colaboradorId || !anoMes) return { data: [] };
  const [ano, mes] = String(anoMes).split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  const { data, error } = await supabase
    .from("ponto_marcacao")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("data_referencia", `${anoMes}-01`)
    .lte("data_referencia", `${anoMes}-${String(ultimo).padStart(2, "0")}`)
    .order("nsr");
  return { data: data || [], error: error?.message };
}

export async function fetchMarcacoesUnidadePeriodo(unidadeId, dataInicio, dataFim) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("ponto_marcacao")
    .select("*")
    .eq("unidade_id", unidadeId)
    .gte("data_referencia", dataInicio)
    .lte("data_referencia", dataFim)
    .order("nsr");
  return { data: data || [], error: error?.message };
}

// Roda a conferência da corrente no banco. Sem linhas devolvidas, íntegra.
export async function conferirCorrente() {
  if (!isSupabaseReady()) return { data: [], erro: "Offline" };
  const { data, error } = await supabase.rpc("ponto_marcacao_conferir");
  if (error) return { data: [], erro: error.message };
  return { data: data || [], integra: (data || []).length === 0 };
}
