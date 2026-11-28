// Margem de contribuição, resultado unitário e ponto de equilíbrio ponderado
// pelo mix (item 8 e 17 do documento do dono). Tudo em centavos.

import { multiplicar } from "./dinheiro.mjs";
import { taxasDoItem } from "./taxas.mjs";

/**
 * Um item vendido num canal.
 * Margem de contribuição = receita da loja − taxas − custos variáveis.
 * Resultado = margem − fixo rateado (quando informado).
 */
export function resultadoDoItem({ precoListaC, custoC, regras = [], descontoLojaPct = 0, descontoAppPct = 0, itensPorPedido = 1, itensNoMes = null, fixoRateadoC = null, data = null }) {
  const descontoLojaC = multiplicar(precoListaC, (Number(descontoLojaPct) || 0) / 100);
  const descontoAppC = multiplicar(precoListaC, (Number(descontoAppPct) || 0) / 100);
  const t = taxasDoItem({ regras, precoListaC, descontoLojaC, descontoAppC, itensPorPedido, itensNoMes, data });
  const receitaLojaC = precoListaC - descontoLojaC;
  const margemC = receitaLojaC - t.totalC - custoC;
  return {
    precoListaC, descontoLojaC, descontoAppC, clientePagaC: precoListaC - descontoLojaC - descontoAppC,
    receitaLojaC, taxasC: t.totalC, taxas: t.linhas, custoC, margemC,
    margemExataC: receitaLojaC - t.totalExatoC - custoC,
    margemPct: receitaLojaC > 0 ? (margemC / receitaLojaC) * 100 : null,
    resultadoC: fixoRateadoC === null ? null : margemC - fixoRateadoC,
    avisos: t.avisos, natureza: "ESTIMATIVA",
  };
}

/**
 * Ponto de equilíbrio gerencial = fixos ÷ margem de contribuição % média
 * PONDERADA pelo mix vendido (receita de cada item × quantidade).
 * mix: [{ receitaC, margemC, quantidade }]. Sem mix ou margem ≤ 0 → aviso.
 */
export function pontoDeEquilibrioPonderado({ fixosC, lucroDesejadoC = 0, mix = [], diasMes = null }) {
  const falta = [];
  if (fixosC === null || fixosC === undefined) falta.push("despesas fixas do mês");
  const validos = mix.filter((x) => Number(x.quantidade) > 0 && x.receitaC > 0 && x.margemC !== null && x.margemC !== undefined);
  if (!validos.length) falta.push("vendas com preço e custo (mix)");
  if (falta.length) return { status: "DADOS INSUFICIENTES", falta };
  const receita = validos.reduce((s, x) => s + x.receitaC * x.quantidade, 0);
  const margem = validos.reduce((s, x) => s + x.margemC * x.quantidade, 0);
  const mcPct = margem / receita;
  if (!(mcPct > 0)) return { status: "INVIAVEL", motivo: "A margem de contribuição média é zero ou negativa: as vendas não pagam os próprios custos.", mcPct: mcPct * 100 };
  const faturamentoC = Math.ceil((fixosC + lucroDesejadoC) / mcPct);
  const dias = Number(diasMes) > 0 ? Number(diasMes) : null;
  return {
    status: "OK", mcPct: mcPct * 100, faturamentoMesC: faturamentoC,
    faturamentoSemanaC: Math.ceil((faturamentoC * 12) / 52),
    faturamentoDiaC: dias ? Math.ceil(faturamentoC / dias) : null,
    natureza: "ESTIMATIVA",
  };
}
