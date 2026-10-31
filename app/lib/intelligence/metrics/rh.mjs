// RH — escala do dia: quem trabalha, em que horário e quem está de folga.
//
// Fonte: o CADASTRO do colaborador (dias de trabalho e horário, inclusive o
// horário por dia da semana) e as folgas lançadas em rh_folgas_esporadicas.
// A regra mora em app/lib/escala-dia.mjs (a mesma da janta dos funcionários).
// Troca de turno que não foi lançada no Héfisto não aparece: a observação diz isso.

import { metrica, insuficiente, CONFIANCA, NATUREZA } from "../core/contratos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { montarEscala } from "../../escala-dia.mjs";

export { horarioDoColaborador, ativoNaData, montarEscala } from "../../escala-dia.mjs";
import { medir, fonte } from "./base.mjs";

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
