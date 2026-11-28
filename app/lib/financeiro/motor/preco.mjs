// Preço mínimo, recomendado e comercial (item 8 do documento do dono).
//
// Caso simples (todas as taxas % sobre a mesma base = preço de lista):
//   preço = custos monetários ÷ (1 − taxas − margem)
// Caso geral (bases diferentes, fixos por pedido, descontos): procura o MENOR
// preço inteiro em centavos cuja margem de contribuição atinge a meta, usando
// as regras uma a uma (taxas.mjs). Os dois caminhos dão o mesmo número quando
// o caso é o simples (teste).

import { centavoDeCima, precoComercial } from "./dinheiro.mjs";
import { taxasDoItem } from "./taxas.mjs";
import { resultadoDoItem } from "./resultado.mjs";

const NATUREZA = "ESTIMATIVA";

/**
 * custoC: custos monetários do item (ingredientes + embalagem + outros), centavos.
 * margemPct: margem desejada sobre o preço (30 = 30%), ou lucroC em reais por item.
 */
export function precoRecomendado({ custoC, regras = [], margemPct = null, lucroC = 0, descontoLojaPct = 0, descontoAppPct = 0, itensPorPedido = 1, itensNoMes = null, finais = [90], data = null } = {}) {
  const falta = [];
  if (custoC === null || custoC === undefined || !(custoC > 0)) falta.push("custo do item");
  if ((margemPct === null || margemPct === undefined || margemPct === "") && !(lucroC > 0)) falta.push("margem desejada ou lucro em reais");
  if (falta.length) return { status: "DADOS INSUFICIENTES", falta, natureza: NATUREZA };
  const m = lucroC > 0 ? 0 : Number(margemPct) / 100;

  // Caso simples: fórmula fechada (e exibida ao dono).
  const simples = regras.every((r) => r.tipo === "percentual" && (r.base || "preco_lista") === "preco_lista") && !descontoLojaPct && !descontoAppPct;
  if (simples) {
    const t = regras.reduce((s, r) => s + Number(r.valor) / 100, 0);
    const den = 1 - t - m;
    if (!(den > 0)) return { status: "INVIAVEL", motivo: "Taxas e margem somam 100% ou mais: não existe preço possível.", natureza: NATUREZA };
    const exatoC = (custoC + lucroC) / den;
    const minimoC = centavoDeCima(exatoC);
    return { status: "OK", exatoC, minimoC, comercialC: precoComercial(minimoC, finais), formula: "custo ÷ (1 − taxas − margem)", natureza: NATUREZA };
  }

  // Caso geral: menor preço que bate a meta (a margem cresce com o preço
  // enquanto as taxas forem menores que 100%; busca binária em centavos).
  const atinge = (p) => {
    const r = resultadoDoItem({ precoListaC: p, custoC, regras, descontoLojaPct, descontoAppPct, itensPorPedido, itensNoMes, data });
    return r.margemExataC - lucroC >= m * r.receitaLojaC - 1e-9;
  };
  let lo = custoC; let hi = custoC * 50 + 100000;
  if (!atinge(hi)) return { status: "INVIAVEL", motivo: "Com essas taxas e essa margem não existe preço possível.", natureza: NATUREZA };
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (atinge(mid)) hi = mid; else lo = mid + 1; }
  const avisos = taxasDoItem({ regras, precoListaC: lo, itensPorPedido, itensNoMes, data }).avisos;
  return { status: "OK", exatoC: lo, minimoC: lo, comercialC: precoComercial(lo, finais), formula: "regras do contrato, uma a uma", avisos, natureza: NATUREZA };
}
