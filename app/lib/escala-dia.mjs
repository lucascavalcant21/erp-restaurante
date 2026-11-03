// ESCALA DO DIA — quem trabalha numa data, em que horário e quem está de folga.
//
// Uma regra só para o Héfisto (pergunta "quem trabalha hoje?") e para a janta
// dos funcionários. Fonte: o cadastro do colaborador (dias de trabalho, horário,
// horário próprio do domingo ou por dia da semana) e as folgas lançadas
// (rh_folgas_esporadicas). O horário do dia é o de jornada-semana.mjs.
// Módulo puro, sem banco.

import { horarioDoDia } from "./jornada-semana.mjs";

const INATIVOS = new Set(["inativo", "desligado", "demitido", "afastado", "ferias", "férias"]);
const hhmm = (v) => {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):?(\d{2})?/);
  return m ? `${m[1].padStart(2, "0")}:${String(m[2] ?? "00").padStart(2, "0")}` : null;
};

/** 0 = domingo … 6 = sábado, da data ISO (sem fuso). */
export function diaDaSemanaIso(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Horário do colaborador num dia da semana (0 = domingo), ou null se não trabalha. */
export function horarioDoColaborador(c, dow) {
  if (c?.horario_por_dia && c.horarios_dia && typeof c.horarios_dia === "object") {
    const h = c.horarios_dia[String(dow)];
    const e = hhmm(h?.e); const s = hhmm(h?.s);
    return e && s ? { entrada: e, saida: s } : null;
  }
  return horarioDoDia(c, dow);
}

export function ativoNaData(c, data) {
  if (INATIVOS.has(String(c?.status || "").trim().toLowerCase())) return false;
  if (c?.data_desligamento && String(c.data_desligamento).slice(0, 10) <= data) return false;
  if (c?.data_admissao && String(c.data_admissao).slice(0, 10) > data) return false;
  return true;
}

/**
 * Escala de uma data a partir do cadastro e das folgas.
 * → { trabalham: [{id, nome, cargo, area, entrada, saida, janta}], folgas: [{id, nome, motivo}], semHorario: [nome] }
 */
export function montarEscala({ colaboradores = [], folgas = [], data }) {
  const dow = diaDaSemanaIso(data);
  const deFolga = new Map(folgas.filter((f) => String(f.data_folga).slice(0, 10) === data).map((f) => [f.colaborador_id, f.descricao || "folga"]));
  const trabalham = []; const emFolga = []; const semHorario = [];
  for (const c of colaboradores) {
    if (!ativoNaData(c, data)) continue;
    const area = String(c.area_escala || c.setor_entrega || "").trim() || null;
    if (deFolga.has(c.id)) { emFolga.push({ id: c.id, nome: c.nome, motivo: deFolga.get(c.id) }); continue; }
    const h = horarioDoColaborador(c, dow);
    if (h) trabalham.push({ id: c.id, nome: c.nome, cargo: c.cargo || null, area, ...h, janta: c.janta_ofertada !== false, ordem: Number(c.ordem_escala) || 999 });
    else if (!c.horario_entrada && !c.horario_por_dia) semHorario.push(c.nome);
  }
  trabalham.sort((a, b) => a.entrada.localeCompare(b.entrada) || a.ordem - b.ordem || String(a.nome).localeCompare(String(b.nome)));
  return { trabalham: trabalham.map(({ ordem, ...x }) => x), folgas: emFolga, semHorario };
}
