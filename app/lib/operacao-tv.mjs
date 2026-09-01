// Modo TV: o que uma tela pendurada na cozinha precisa mostrar.
//
// A Central Operacional é feita para quem está sentado, clicando e filtrando.
// A TV é o contrário: ninguém toca nela, ninguém está perto, e ela compete com
// o barulho da praça. Então o corte aqui não é "tudo o que existe" e sim "o que
// muda o que alguém faz nos próximos minutos" — atrasado primeiro, depois o que
// está acontecendo, depois o que vem. O resto vira número no rodapé.
import { statusDaExecucao } from "./operacao-agenda.mjs";

// Quantos itens cabem em cada bloco antes de a fonte ficar pequena demais para
// ler de longe. Passou disso, o painel mostra "+N" em vez de encolher a lista.
export const LIMITE_POR_BLOCO = 6;

const EM_CURSO = ["EM_ANDAMENTO", "DISPONIVEL"];
const FEITAS = ["CONCLUIDA", "CONCLUIDA_COM_ATRASO"];

function porHorario(a, b) {
  return String(a.previsto_para || "").localeCompare(String(b.previsto_para || ""));
}

/**
 * Divide as execuções do dia nos blocos do painel.
 *
 * O status é recalculado com o relógio de agora, e não reaproveitado do que
 * veio do banco: a TV fica horas na parede entre uma busca e outra, e uma
 * rotina que venceu às 15h não pode seguir pintada de "disponível" até a
 * próxima atualização.
 */
export function painelDoDia(execucoes = [], ncs = [], agora = new Date()) {
  const comStatus = (execucoes || [])
    .filter(Boolean)
    .map(e => ({ ...e, status: statusDaExecucao(e, agora) }));

  const atrasadas = comStatus.filter(e => e.status === "ATRASADA").sort(porHorario);
  const emCurso = comStatus.filter(e => EM_CURSO.includes(e.status)).sort(porHorario);
  const aSeguir = comStatus.filter(e => e.status === "AGENDADA").sort(porHorario);
  const concluidas = comStatus.filter(e => FEITAS.includes(e.status));
  const total = comStatus.filter(e => e.status !== "CANCELADA").length;

  return {
    // `todas` é a mesma lista com o status já recalculado. Existe para quem
    // precisa do conjunto (o score, por exemplo) sem ter de concatenar os
    // blocos de volta e correr o risco de esquecer um.
    todas: comStatus,
    atrasadas, emCurso, aSeguir, concluidas,
    contadores: {
      total,
      atrasadas: atrasadas.length,
      emCurso: emCurso.length,
      aSeguir: aSeguir.length,
      concluidas: concluidas.length,
      ncs: (ncs || []).length,
      // Quanto do dia já saiu. Cancelada não conta nem como feita nem como
      // pendente, senão um dia com tudo cancelado apareceria como 0% e a
      // cozinha leria isso como atraso.
      progresso: total ? Math.round((concluidas.length / total) * 100) : 0,
    },
  };
}

/** Uma linha da TV: o essencial, já formatado. */
export function linhaDaExecucao(execucao) {
  const iso = execucao?.previsto_para;
  return {
    id: execucao?.id,
    hora: iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--",
    nome: execucao?.processo?.nome || "Rotina",
    setor: execucao?.processo?.setor || "",
    // Só aparece depois que alguém inicia — antes disso não há a quem cobrar.
    responsavel: execucao?.responsavel_nome || "",
    critica: String(execucao?.processo?.criticidade || "").toUpperCase() === "ALTA",
    progresso: execucao?.total_itens
      ? Math.round((Number(execucao.itens_respondidos) || 0) / Number(execucao.total_itens) * 100)
      : null,
  };
}
