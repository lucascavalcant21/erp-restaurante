// FATURAMENTO — fonte oficial do Héfisto: fin_faturamento_diario (receita =
// vendas brutas − cancelamentos − descontos), a mesma do CMV % e do DRE.
// Dia sem lançamento nunca vira zero; período com dia faltando sai PARCIAL
// (soma do que foi lançado, com a lista do que falta) — nunca extrapolado.

import { metrica, insuficiente, confiancaPorCompletude, CONFIANCA } from "../core/contratos.mjs";
import { diasDoPeriodo, periodoAnterior, ddmm, somarDias } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { MOTIVO_SEM_FATURAMENTO } from "../../cmv-dados.mjs";
import { medir, r2, soma, fonte } from "./base.mjs";

const COLUNAS = "data, vendas_brutas, cancelamentos, descontos, receita, fonte";

/** Linhas do faturamento entre duas datas (inclusive). */
export async function lerFaturamentoDiario(amb, de, ate) {
  const linhas = await ler(amb.dbe.from("fin_faturamento_diario").select(COLUNAS).gte("data", de).lte("data", ate).order("data"), "fin_faturamento_diario");
  return (linhas || []).map((l) => ({ ...l, data: String(l.data).slice(0, 10), receita: Number(l.receita), vendas_brutas: Number(l.vendas_brutas), cancelamentos: Number(l.cancelamentos) || 0, descontos: Number(l.descontos) || 0 }));
}

/** Resumo puro de um período a partir das linhas diárias. */
export function resumirPeriodo(periodo, linhas) {
  const porDia = new Map(linhas.map((l) => [l.data, l]));
  const dias = diasDoPeriodo(periodo);
  const lancados = dias.filter((d) => porDia.has(d));
  const faltando = dias.filter((d) => !porDia.has(d));
  const doPeriodo = lancados.map((d) => porDia.get(d));
  return {
    dias: dias.length,
    lancados: lancados.length,
    faltando,
    total: r2(soma(doPeriodo, (l) => l.receita)),
    vendasBrutas: r2(soma(doPeriodo, (l) => l.vendas_brutas)),
    cancelamentos: r2(soma(doPeriodo, (l) => l.cancelamentos)),
    descontos: r2(soma(doPeriodo, (l) => l.descontos)),
    fontesDeclaradas: [...new Set(doPeriodo.map((l) => String(l.fonte || "").trim()).filter(Boolean))].slice(0, 5),
    porDia: doPeriodo.map((l) => ({ data: l.data, receita: r2(l.receita) })),
  };
}

const listaDias = (ds) => (ds.length > 6 ? `${ds.slice(0, 6).map(ddmm).join(", ")}…` : ds.map(ddmm).join(", "));

/**
 * @param {object} amb
 * @param {object} periodo  resolverPeriodo(...)
 * @param {{comparar?: boolean}} [op]
 */
export function faturamento(amb, periodo, { comparar = true } = {}) {
  return medir(amb, { id: "faturamento", capacidade: "faturamento", periodo }, async (consultas) => {
    const anterior = comparar ? periodoAnterior(periodo) : null;
    let linhas;
    try {
      linhas = await lerFaturamentoDiario(amb, anterior ? anterior.de : periodo.de, periodo.ate);
    } catch (e) {
      if (e.ausente) {
        return insuficiente({ metrica: "faturamento", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(), motivo: MOTIVO_SEM_FATURAMENTO, faltando: ["fin_faturamento_diario"] });
      }
      throw e;
    }
    const atual = resumirPeriodo(periodo, linhas);
    const fontes = [fonte("fin_faturamento_diario", "Faturamento diário informado (vendas − cancelamentos − descontos)")];

    if (atual.lancados === 0) {
      const motivo = periodo.dias === 1
        ? `O faturamento de ${periodo.tipo === "hoje" ? "hoje" : ddmm(periodo.de)} ainda não foi lançado no Héfisto.`
        : `Nenhum dia de ${periodo.rotulo} tem faturamento lançado.`;
      return insuficiente({ metrica: "faturamento", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(), motivo, faltando: atual.faltando.map((d) => `faturamento de ${ddmm(d)}`) });
    }

    const completude = atual.lancados / atual.dias;
    const observacoes = [];
    if (atual.faltando.length) {
      observacoes.push(`Dados parciais: ${atual.lancados} de ${atual.dias} dias lançados. Sem lançamento: ${listaDias(atual.faltando)}. O valor é a soma só dos dias lançados.`);
    }

    let comparacao = null;
    if (anterior) {
      const ant = resumirPeriodo(anterior, linhas);
      if (ant.lancados === ant.dias && completude === 1 && ant.total > 0) {
        comparacao = {
          periodo: { de: anterior.de, ate: anterior.ate, rotulo: anterior.rotulo },
          valor: ant.total,
          diferenca: r2(atual.total - ant.total),
          diferencaPct: r2(((atual.total - ant.total) / ant.total) * 100),
        };
      } else {
        observacoes.push(`Comparação com ${anterior.rotulo} indisponível: ${ant.lancados < ant.dias ? `${ant.dias - ant.lancados} dia(s) sem lançamento no período anterior` : completude < 1 ? "o período atual está incompleto" : "o período anterior não tem faturamento"}.`);
      }
    }

    return metrica({
      metrica: "faturamento",
      valor: atual.total,
      unidade: "BRL",
      periodo: { de: periodo.de, ate: periodo.ate, rotulo: periodo.rotulo },
      comparacao,
      fontes,
      consultas: consultas(),
      escopo: amb.escopo,
      completude,
      confianca: confiancaPorCompletude(completude),
      apuradoEm: amb.apuradoEm,
      observacoes,
      detalhes: {
        vendasBrutas: atual.vendasBrutas, cancelamentos: atual.cancelamentos, descontos: atual.descontos,
        diasLancados: atual.lancados, dias: atual.dias, faltando: atual.faltando, porDia: atual.porDia,
        fontesDeclaradas: atual.fontesDeclaradas,
      },
    });
  });
}

/**
 * Histórico diário (para o baseline de anomalias): últimas `semanas` semanas
 * antes de `ate`. Só devolve linhas; quem decide o que é comparável é o detector.
 */
export async function historicoDiario(amb, ate, semanas = 8) {
  const de = somarDias(ate, -7 * semanas);
  return lerFaturamentoDiario(amb, de, ate);
}

export { CONFIANCA };
