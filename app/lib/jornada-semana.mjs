// Resumo da jornada contratada da semana, em uma linha legível.
//
// "Terça a domingo: 15:40 às 00:00" em vez de seis linhas iguais. Quando o
// domingo tem horário próprio, ele se separa sozinho:
// "Terça a sábado: 15:40 às 00:00 · Domingo: 09:00 às 17:20".
//
// Módulo puro, sem Supabase: agrupar dias consecutivos é o tipo de lógica que
// erra em silêncio, e aqui ela tem teste.

const NOMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// A semana da casa começa na segunda e termina no domingo — é assim que a
// escala é falada e é assim que o espelho imprime. Com a ordem do JavaScript
// (domingo = 0 primeiro), "terça a domingo" viraria dois grupos soltos.
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

const hhmm = (v) => {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2}):?(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

// Horário contratado de um dia da semana, ou null se não trabalha.
export function horarioDoDia(colaborador, diaSemana) {
  if (!colaborador) return null;
  const dias = String(colaborador.dias_trabalho ?? "").trim();
  if (dias) {
    const lista = dias.split(",").map(s => s.trim()).filter(Boolean);
    if (lista.length && !lista.includes(String(diaSemana))) return null;
  }
  const ehDomingo = diaSemana === 0;
  const entrada = hhmm((ehDomingo && colaborador.horario_dom_entrada) || colaborador.horario_entrada);
  const saida = hhmm((ehDomingo && colaborador.horario_dom_saida) || colaborador.horario_saida);
  if (!entrada || !saida) return null;
  return { entrada, saida };
}

// Agrupa dias seguidos com o mesmo horário. Devolve uma lista de trechos:
// [{ dias: [2,3,4,5,6], entrada, saida }, { dias: [0], ... }]
export function trechosDaSemana(colaborador) {
  const trechos = [];
  for (const dia of ORDEM) {
    const h = horarioDoDia(colaborador, dia);
    if (!h) continue;
    const ultimo = trechos[trechos.length - 1];
    // Só junta se o dia anterior da ORDEM também entrou no trecho: dias
    // salteados (folga no meio) precisam virar trechos separados, senão
    // "terça e quinta" sairia como "terça a quinta".
    const seguido = ultimo
      && ultimo.entrada === h.entrada
      && ultimo.saida === h.saida
      && ORDEM.indexOf(dia) === ORDEM.indexOf(ultimo.dias[ultimo.dias.length - 1]) + 1;
    if (seguido) ultimo.dias.push(dia);
    else trechos.push({ dias: [dia], entrada: h.entrada, saida: h.saida });
  }
  return trechos;
}

// "Terça a domingo", e não "Terça a Domingo": em português só o primeiro
// nome abre a frase. O segundo vai minúsculo.
const minusculo = (n) => n.charAt(0).toLowerCase() + n.slice(1);

const rotuloDias = (dias) => {
  if (dias.length === 1) return NOMES[dias[0]];
  if (dias.length === 2) return `${NOMES[dias[0]]} e ${minusculo(NOMES[dias[1]])}`;
  return `${NOMES[dias[0]]} a ${minusculo(NOMES[dias[dias.length - 1]])}`;
};

// Uma linha por trecho: ["Terça a sábado: 15:40 às 00:00", "Domingo: 09:00 às 17:20"]
export function linhasJornadaSemana(colaborador) {
  return trechosDaSemana(colaborador)
    .map(t => `${rotuloDias(t.dias)}: ${t.entrada} às ${t.saida}`);
}

// Tudo numa string só, para quando não couber quebrar em linhas.
export function resumoJornadaSemana(colaborador) {
  return linhasJornadaSemana(colaborador).join(" · ");
}
