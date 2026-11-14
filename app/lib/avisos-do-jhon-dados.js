// Lê do banco o que o Jhon precisa para avisar o dono.
//
// Cada leitura que falha vira `null` (não lida), nunca lista vazia: o módulo
// puro transforma `null` em "DADOS INSUFICIENTES" na tela, em vez de dizer que
// está tudo certo.
import { supabase, isSupabaseReady } from "./supabase";
import { fetchColaboradores, fetchAtestadosUnidade } from "./rh";
import { fetchPontoHoje, fetchPontosAbertos, corrigirBatida } from "./ponto";
import { fetchExecucoes, fetchNaoConformidades } from "./operacao-inteligente";
import { atestadoNaData } from "./ponto-status.mjs";
import { avisosDoJhon, ajusteDaEscolha, dataSP } from "./avisos-do-jhon.mjs";

// Quantos dias para trás o Jhon procura saída esquecida. Mais que uma semana
// já é assunto do fechamento do mês, não do aviso do dia.
const DIAS_SAIDA_ESQUECIDA = 7;

const ou = (r) => (r && !r.error ? r.data || [] : null);

export async function carregarAvisosDoJhon(unidadeId, agora = new Date()) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return avisosDoJhon({ agora });
  }
  const hoje = dataSP(agora);
  const desde = dataSP(new Date(agora.getTime() - DIAS_SAIDA_ESQUECIDA * 86400000));

  const [colabs, pontos, abertos, execs, ncs, atestados] = await Promise.all([
    fetchColaboradores(unidadeId).catch(() => null),
    fetchPontoHoje(unidadeId).catch(() => null),
    fetchPontosAbertos(unidadeId, desde).catch(() => null),
    fetchExecucoes(unidadeId, { data: hoje }).catch(() => null),
    fetchNaoConformidades(unidadeId, { status: "ABERTA" }).catch(() => null),
    fetchAtestadosUnidade(unidadeId, { desde: hoje }).catch(() => null),
  ]);

  const colaboradores = ou(colabs);
  const ids = (colaboradores || []).map(c => c.id);

  let folgasHoje = [];
  if (ids.length) {
    const { data, error } = await supabase.from("rh_folgas_esporadicas")
      .select("colaborador_id").in("colaborador_id", ids).eq("data_folga", hoje);
    folgasHoje = error ? [] : (data || []).map(f => f.colaborador_id);
  }

  const listaAtestados = ou(atestados) || [];
  const atestadosHoje = ids.filter(id =>
    atestadoNaData(listaAtestados.filter(a => a.colaborador_id === id), hoje));

  // fetchPontoHoje não devolve `error`: lista vazia de um banco que respondeu
  // é dado real ("ninguém bateu"); `null` só quando a chamada caiu.
  return avisosDoJhon({
    agora,
    colaboradores,
    pontosHoje: pontos ? pontos.data || [] : null,
    pontosAbertos: ou(abertos),
    folgasHoje,
    atestadosHoje,
    execucoes: ou(execs),
    ncs: ou(ncs),
  });
}

/**
 * O dono aprovou um ajuste de ponto proposto pelo Jhon. Grava pelo caminho
 * oficial (`corrigirBatida`): marcação de ajuste no livro, com autor e
 * motivo, e a original preservada.
 */
export async function aprovarAjusteDoJhon({ unidadeId, acao, escolha, horaDigitada, quemAprovou }) {
  const ajuste = ajusteDaEscolha(acao, escolha, { horaDigitada, quemAprovou });
  if (ajuste === null) return { error: null, nadaAGravar: true };
  if (ajuste.erro) return { error: ajuste.erro };
  if (!unidadeId || unidadeId === "todas") return { error: "Escolha a unidade antes de ajustar o ponto." };
  return corrigirBatida({ ...ajuste, unidadeId });
}
