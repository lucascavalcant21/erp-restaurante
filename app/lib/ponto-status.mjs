// Como o RH conta o dia de cada pessoa, em uma frase.
//
// Existe como módulo puro porque a mesma situação era escrita de três jeitos
// diferentes em três telas ("Trabalhando · 08:12", "Sem ponto hoje", "Saiu
// 17:03"). Quem lê o RH não devia precisar traduzir rótulo de tela para
// entender se o funcionário está no intervalo ou já foi embora.

const HORA = (valor) => {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

// tom: usado pela tela para escolher a cor. "neutro" quando não há nada a
// cobrar, "atencao" quando falta bater algo, "ok" durante o trabalho normal.
export const TOM = {
  SEM_ENTRADA: "atencao",
  TRABALHANDO: "ok",
  INTERVALO: "pausa",
  ENCERRADO: "encerrado",
};

export function situacaoDoPonto(registro) {
  const r = registro || {};
  const entrada = r.hora_entrada || null;
  const saidaIntervalo = r.hora_saida_intervalo || null;
  const retornoIntervalo = r.hora_retorno_intervalo || null;
  const saida = r.hora_saida || null;

  if (!entrada) {
    return { texto: "Ainda não bateu o ponto de entrada", tom: TOM.SEM_ENTRADA, semIntervalo: false };
  }

  // Quem já encerrou o dia sem nenhuma marcação de intervalo precisa aparecer
  // assim para o RH: é hora extra em potencial e questão trabalhista, não
  // detalhe de tela.
  const semIntervalo = !saidaIntervalo && !retornoIntervalo;

  if (saida) {
    const texto = `Finalizou o trabalho às ${HORA(saida)}`;
    return {
      texto: semIntervalo ? `${texto} · não tirou intervalo` : texto,
      tom: TOM.ENCERRADO,
      semIntervalo,
    };
  }

  if (saidaIntervalo && !retornoIntervalo) {
    return { texto: "Está em intervalo.", tom: TOM.INTERVALO, semIntervalo: false };
  }

  if (retornoIntervalo) {
    return {
      texto: `Voltou do intervalo às ${HORA(retornoIntervalo)} e está trabalhando`,
      tom: TOM.TRABALHANDO,
      semIntervalo: false,
    };
  }

  return {
    texto: `Bateu o ponto de entrada às ${HORA(entrada)}`,
    tom: TOM.TRABALHANDO,
    semIntervalo,
  };
}

// Cores por tom, para as telas não inventarem cada uma a sua.
export const CORES_TOM = {
  atencao:   { cor: "#B45309", fundo: "rgba(245,158,11,0.12)" },
  ok:        { cor: "#15803D", fundo: "rgba(34,197,94,0.12)" },
  pausa:     { cor: "#7C3AED", fundo: "rgba(124,58,237,0.12)" },
  encerrado: { cor: "#1D4ED8", fundo: "rgba(59,130,246,0.12)" },
};
