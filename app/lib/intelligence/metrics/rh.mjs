// RH — escala do dia: quem trabalha, em que horário e quem está de folga.
//
// Fonte: o CADASTRO do colaborador (dias de trabalho e horário, inclusive o
// horário por dia da semana) e as folgas lançadas em rh_folgas_esporadicas.
// A regra do horário do dia é a mesma de jornada-semana.mjs / jornada-calculo.mjs.
// Troca de turno que não foi lançada no Héfisto não aparece: a observação diz isso.

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { diaDaSemana } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { horarioDoDia } from "../../jornada-semana.mjs";
import { medir, fonte } from "./base.mjs";

const INATIVOS = new Set(["inativo", "desligado", "demitido", "afastado", "ferias", "férias"]);
const hhmm = (v) => {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):?(\d{2})?/);
  return m ? `${m[1].padStart(2, "0")}:${String(m[2] ?? "00").padStart(2, "0")}` : null;
};

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
 * Pura: monta a escala de uma data a partir do cadastro e das folgas.
 * → { trabalham: [{nome, cargo, area, entrada, saida}], folgas: [{nome, motivo}], semHorario: [nome] }
 */
export function montarEscala({ colaboradores = [], folgas = [], data }) {
  const dow = diaDaSemana(data);
  const deFolga = new Map(folgas.filter((f) => String(f.data_folga).slice(0, 10) === data).map((f) => [f.colaborador_id, f.descricao || "folga"]));
  const trabalham = []; const emFolga = []; const semHorario = [];
  for (const c of colaboradores) {
    if (!ativoNaData(c, data)) continue;
    const area = String(c.area_escala || c.setor_entrega || "").trim() || null;
    if (deFolga.has(c.id)) { emFolga.push({ nome: c.nome, motivo: deFolga.get(c.id) }); continue; }
    const h = horarioDoColaborador(c, dow);
    if (h) trabalham.push({ nome: c.nome, cargo: c.cargo || null, area, ...h, ordem: Number(c.ordem_escala) || 999 });
    else if (!c.horario_entrada && !c.horario_por_dia) semHorario.push(c.nome);
  }
  trabalham.sort((a, b) => a.entrada.localeCompare(b.entrada) || a.ordem - b.ordem || String(a.nome).localeCompare(String(b.nome)));
  return { trabalham: trabalham.map(({ ordem, ...x }) => x), folgas: emFolga, semHorario };
}

export function escalaDoDia(amb, { data = amb.hoje } = {}) {
  const periodo = { de: data, ate: data, rotulo: data === amb.hoje ? "hoje" : data };
  return medir(amb, { id: "escala_dia", capacidade: "escala", periodo }, async (consultas) => {
    const fontes = [fonte("colaboradores", "Dias e horários do cadastro"), fonte("rh_folgas_esporadicas", "Folgas lançadas")];
    const colaboradores = (await ler(amb.dbe.from("colaboradores").select("id, nome, cargo, status, data_admissao, data_desligamento, dias_trabalho, horario_entrada, horario_saida, horario_dom_entrada, horario_dom_saida, horario_por_dia, horarios_dia, area_escala, setor_entrega, ordem_escala"), "colaboradores")) || [];
    let folgas = [];
    try {
      folgas = (await ler(amb.dbe.from("rh_folgas_esporadicas").select("colaborador_id, data_folga, descricao").eq("data_folga", data), "rh_folgas_esporadicas")) || [];
    } catch (e) {
      if (!e.ausente) throw e;
    }
    const esc = montarEscala({ colaboradores, folgas, data });
    if (!colaboradores.length || (!esc.trabalham.length && !esc.folgas.length && esc.semHorario.length)) {
      return insuficiente({ metrica: "escala_dia", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: colaboradores.length ? "Nenhum colaborador ativo tem dias e horário de trabalho no cadastro." : "Nenhum colaborador cadastrado nesta unidade.",
        faltando: ["dias de trabalho e horário no cadastro do colaborador"] });
    }
    const observacoes = ["Pela jornada do cadastro e pelas folgas lançadas; troca de turno não lançada não aparece."];
    if (esc.semHorario.length) observacoes.push(`${esc.semHorario.length} colaborador(es) sem horário no cadastro: ${esc.semHorario.slice(0, 5).join(", ")}.`);
    return metrica({
      metrica: "escala_dia", valor: esc.trabalham.length, unidade: "pessoas", periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: esc.semHorario.length ? 0.9 : 1, confianca: esc.semHorario.length ? CONFIANCA.MEDIA : CONFIANCA.ALTA, natureza: NATUREZA.REAL,
      apuradoEm: amb.apuradoEm, observacoes, detalhes: esc,
    });
  });
}
