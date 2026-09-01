// Rankings da operação: como cada pessoa e cada setor vêm se saindo ao longo
// do tempo, e não só o agregado de hoje que a Central já mostra.
//
// Duas honestidades que o módulo inteiro depende de manter:
//
// 1. Execução só ganha responsável quando ALGUÉM INICIA (iniciarExecucao grava
//    responsavel_id). Rotina que ninguém tocou não tem dono — e é justamente a
//    que mais pesa no dia. Ela não pode ser jogada na conta de uma pessoa
//    qualquer, nem sumir da tela: sai do ranking de pessoas e é devolvida à
//    parte, em `semResponsavel`, para alguém perguntar por que ficou órfã.
//
// 2. Quem fez uma rotina e acertou aparece com 100%. Ranquear isso acima de
//    quem fez quarenta e acertou 95% premia quem trabalhou menos. Abaixo do
//    mínimo a pessoa é listada separada, como "poucos dados", em vez de
//    ordenada junto.
import { calcularScore } from "./operacao-agenda.mjs";

// Quantas execuções alguém precisa ter no período para entrar no ranking.
export const MINIMO_PARA_RANQUEAR = 3;

const FEITAS = ["CONCLUIDA", "CONCLUIDA_COM_ATRASO"];

function agrupar(execucoes, chave) {
  const grupos = new Map();
  for (const e of execucoes || []) {
    if (!e || e.status === "CANCELADA") continue;
    const k = chave(e);
    if (k == null) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(e);
  }
  return grupos;
}

function medir(nome, lista) {
  const s = calcularScore({ execucoes: lista });
  const feitas = lista.filter(e => FEITAS.includes(e.status));
  return {
    nome,
    total: lista.length,
    concluidas: feitas.length,
    atrasadas: lista.filter(e => e.status === "ATRASADA").length,
    comAtraso: feitas.filter(e => e.status === "CONCLUIDA_COM_ATRASO").length,
    naoConformes: feitas.reduce((n, e) => n + (Number(e.itens_nao_conformes) || 0), 0),
    score: s.score,
    pontualidade: s.pontualidade,
    execucao: s.execucao,
    qualidade: s.qualidade,
  };
}

// Score maior primeiro; empate desempata por quem fez mais — trabalhar mais
// com o mesmo aproveitamento vale mais que trabalhar menos.
function porDesempenho(a, b) {
  if (b.score !== a.score) return (b.score ?? -1) - (a.score ?? -1);
  return b.concluidas - a.concluidas;
}

export function rankingPorPessoa(execucoes = [], { minimo = MINIMO_PARA_RANQUEAR } = {}) {
  const comDono = (execucoes || []).filter(e => e && e.responsavel_id && e.status !== "CANCELADA");
  const semResponsavel = (execucoes || [])
    .filter(e => e && !e.responsavel_id && e.status !== "CANCELADA");

  const grupos = agrupar(comDono, e => e.responsavel_id);
  const medidos = [...grupos.entries()].map(([id, lista]) => ({
    id,
    ...medir(lista[0]?.responsavel_nome || "Sem nome", lista),
  }));

  return {
    ranqueados: medidos.filter(m => m.total >= minimo).sort(porDesempenho),
    poucosDados: medidos.filter(m => m.total < minimo).sort(porDesempenho),
    semResponsavel: {
      total: semResponsavel.length,
      atrasadas: semResponsavel.filter(e => e.status === "ATRASADA").length,
    },
    minimo,
  };
}

export function rankingPorSetor(execucoes = []) {
  // Setor vem do processo e existe sempre, então aqui nada fica de fora.
  const grupos = agrupar(execucoes, e => (e.processo?.setor || "sem setor").toLowerCase());
  return [...grupos.entries()]
    .map(([setor, lista]) => ({ setor, ...medir(setor, lista) }))
    .sort(porDesempenho);
}

/** Score de cada dia do período, na ordem, para desenhar a tendência. */
export function serieDiaria(execucoes = []) {
  const grupos = agrupar(execucoes, e => e.data_referencia);
  return [...grupos.entries()]
    .map(([dia, lista]) => {
      const s = calcularScore({ execucoes: lista });
      return {
        dia,
        score: s.score,
        total: lista.length,
        concluidas: lista.filter(e => FEITAS.includes(e.status)).length,
      };
    })
    .sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
}

/** As rotinas que mais falham no período — onde o processo, e não a pessoa, é o problema. */
export function processosQueMaisFalham(execucoes = [], limite = 5) {
  const grupos = agrupar(execucoes, e => e.processo?.nome || null);
  return [...grupos.entries()]
    .map(([nome, lista]) => {
      const feitas = lista.filter(e => FEITAS.includes(e.status));
      return {
        nome,
        total: lista.length,
        // Falha = não fez, fez atrasado, ou fez com item não conforme.
        falhas: lista.filter(e => e.status === "ATRASADA").length
          + feitas.filter(e => e.status === "CONCLUIDA_COM_ATRASO" || (Number(e.itens_nao_conformes) || 0) > 0).length,
      };
    })
    .filter(p => p.falhas > 0)
    .sort((a, b) => b.falhas - a.falhas || b.total - a.total)
    .slice(0, limite);
}
