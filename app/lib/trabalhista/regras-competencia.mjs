// Qual regra de pagamento vale numa competência (HDEV-RH-001).
//
// A folha calcula com REGRAS_CLT (jornada-calculo.mjs) até a convenção ser
// ATIVADA para a empresa (rh_convencoes.status = 'ativa', depois da revisão
// do contador). Ativada, vale só para competências dentro da vigência e
// ainda abertas: espelho/folha fechada não é recalculada.

import { REGRAS_CLT } from "../jornada-calculo.mjs";
import { CCT_FOZ_2026_2027, citar } from "./cct-foz-2026-2027.mjs";

/** Regras de pagamento de uma convenção no formato do jornada-calculo. */
export function regrasDaConvencao(cct = CCT_FOZ_2026_2027) {
  const n = cct.adicional_noturno;
  return Object.freeze({
    id: cct.id,
    noturnoPct: n.adicional_pct,
    extraPct: cct.hora_extra.adicional_pct,
    feriadoPct: 100,
    noturnoInicioH: Number(n.inicio.slice(0, 2)),
    noturnoFimH: Number(n.fim.slice(0, 2)),
    naoNoturnoSeInicioAposH: Number(n.nao_noturno_se_inicio_apos.slice(0, 2)),
    horaFictaSoEntre22e5: true,
    fundamentos: [citar(n.fonte), citar(n.fonte_exclusao), citar(cct.hora_extra.fonte), citar(cct.feriados.fonte), "CLT art. 73 §1º (hora reduzida na faixa 22h–5h)"],
  });
}

/**
 * competencia: "AAAA-MM". convencao: { status, cct } vinda do cadastro.
 * fechada: true quando o espelho/folha daquele mês já foi fechado.
 */
export function regrasDaCompetencia(competencia, { convencao = null, fechada = false } = {}) {
  if (fechada) return { regras: REGRAS_CLT, motivo: "competência fechada: mantém o cálculo com que foi fechada" };
  if (!convencao || convencao.status !== "ativa") return { regras: REGRAS_CLT, motivo: "convenção não ativada" };
  const cct = convencao.cct || CCT_FOZ_2026_2027;
  const dia = `${competencia}-01`;
  if (dia < cct.vigencia.inicio.slice(0, 7) + "-01" || dia > cct.vigencia.fim) return { regras: REGRAS_CLT, motivo: "fora da vigência da convenção" };
  return { regras: regrasDaConvencao(cct), motivo: `vigente: ${cct.nome}` };
}
