// BUFFET: LUCRO, PONTO DE EQUILÍBRIO E SOBRAS (pedido do dono, 21/11/2026:
// "no evento vamos para o buffet, focando no lucro, ponto de equilíbrio e
// sobras em peso e dinheiro"). Tudo sai do motor do orçamento
// (resumoDoOrcamento): nenhuma conta paralela de custo.
//
//   Produção por item = gramas por pessoa × pessoas-equivalentes × (1 + sobra%)
//   Sobra de segurança = a parte do "+ sobra%" (peso e R$)
//   Ponto de equilíbrio = menor nº de convidados em que o lucro líquido ≥ 0,
//     no preço por pessoa de hoje (procura usando o próprio orçamento)
//   Depois do evento: sobra real (kg) × custo do kg produzido = R$ que sobrou;
//     consumo real por pessoa = (produzido − sobra) ÷ pessoas-equivalentes

import { resumoDoOrcamento } from "./evento-orcamento.mjs";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r0 = (n) => Math.round(Number(n) || 0);
const pos = (v) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Produção e sobra planejada de cada item (g para comida, ml para o bar). */
export function producaoDoBuffet(r) {
  const pessoas = r?.pessoasConsumo || 0;
  const fator = 1 + (r?.sobraPct || 0) / 100;
  const itens = (r?.itens || []).map((i) => {
    const un = i.secao === "bar" ? "ml" : "g";
    let porPessoaG = null; let produzirG = null; let custo = null;
    if (i.emTotal) {
      produzirG = i.gramasTotal > 0 ? i.gramasTotal : null;
      porPessoaG = produzirG && pessoas > 0 ? produzirG / pessoas : null;
      custo = i.custoTotalFixo || 0;
    } else {
      porPessoaG = i.pesoPorcao > 0 ? i.porPessoa * i.pesoPorcao : null;
      produzirG = porPessoaG !== null ? porPessoaG * pessoas * fator : null;
      custo = i.custoPorPessoa * pessoas * fator;
    }
    const sobraSegG = !i.emTotal && produzirG !== null ? produzirG - produzirG / fator : 0;
    const custoKg = produzirG > 0 ? (custo / produzirG) * 1000 : null;
    return {
      id: i.id, nome: i.nome, secao: i.secao, un, emTotal: !!i.emTotal,
      porPessoaG: porPessoaG === null ? null : r0(porPessoaG),
      produzirG: produzirG === null ? null : r0(produzirG),
      sobraSegG: r0(sobraSegG), sobraSegValor: r2(!i.emTotal ? custo - custo / fator : 0),
      custo: r2(custo), custoKg: custoKg === null ? null : r2(custoKg),
      semPeso: produzirG === null,
    };
  });
  const comida = itens.filter((i) => i.un === "g");
  const soma = (l, k) => l.reduce((t, i) => t + (i[k] || 0), 0);
  return {
    itens,
    comidaProduzirG: r0(soma(comida, "produzirG")),
    comidaPorPessoaG: pessoas > 0 ? r0(soma(comida, "produzirG") / pessoas) : null,
    sobraSegG: r0(soma(comida, "sobraSegG")),
    sobraSegValor: r2(soma(itens, "sobraSegValor")),
    semPeso: itens.filter((i) => i.semPeso).map((i) => i.nome),
  };
}

/** Menor nº de convidados que atende `cond` no preço de hoje (busca binária no motor). */
function menorConvidados(orc, fichas, cond, max = 5000) {
  const ok = (n) => cond(resumoDoOrcamento(orc, fichas, { convidados: n }));
  if (!ok(max)) return null;
  let lo = 1; let hi = max;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid + 1; }
  return lo;
}

/** Ponto de equilíbrio e meta em convidados, no preço por pessoa de hoje. */
export function equilibrioDoBuffet(orc = {}, fichas = [], r = null) {
  const res = r || resumoDoOrcamento(orc, fichas);
  if (!(res.precoPorPessoa > 0)) return { situacao: "sem_dado", motivo: "Defina o valor por pessoa para saber com quantos convidados o evento se paga." };
  if (!(res.convidados > 0)) return { situacao: "sem_dado", motivo: "Informe quantos convidados (etapa Cliente)." };
  const pe = menorConvidados(orc, fichas, (x) => x.receita > 0 && x.lucro >= 0);
  const meta = res.meta?.definida ? menorConvidados(orc, fichas, (x) => x.receita > 0 && x.meta?.atingida) : null;
  // quanto cada convidado a mais deixa (lucro marginal), medido no motor
  const um = resumoDoOrcamento(orc, fichas, { convidados: res.convidados + 1 });
  const porConvidado = r2(um.lucro - res.lucro);
  return {
    situacao: pe === null ? "alerta" : res.convidados < pe ? "alerta" : meta !== null && res.convidados < meta ? "atencao" : "ok",
    convidados: res.convidados, preco: res.precoPorPessoa,
    pontoEquilibrio: pe, folga: pe === null ? null : res.convidados - pe,
    meta, porConvidado,
    texto: pe === null ? `No valor de ${brl(res.precoPorPessoa)} por pessoa, nenhum número de convidados cobre os custos: o preço não paga o custo de cada convidado.`
      : `Com ${brl(res.precoPorPessoa)} por pessoa, o evento se paga a partir de ${pe} convidados${res.convidados >= pe ? ` (você tem ${res.convidados}: ${res.convidados - pe} de folga)` : ` (você tem ${res.convidados}: faltam ${pe - res.convidados})`}.`,
  };
}

/** Depois do evento: sobra real de cada item em peso e dinheiro. sobras = { itemId: gramas }. */
export function sobrasDoBuffet(producao, sobras = {}, pessoasConsumo = 0) {
  const linhas = (producao?.itens || []).filter((i) => !i.semPeso).map((i) => {
    const s = sobras?.[i.id];
    const lancada = s !== undefined && s !== null && s !== "";
    const g = lancada ? Math.min(pos(s), i.produzirG) : null;
    const valor = lancada && i.custoKg !== null ? r2((g / 1000) * i.custoKg) : null;
    const consumoG = lancada ? i.produzirG - g : null;
    return {
      ...i, lancada, sobraG: g, sobraValor: valor,
      sobraPct: lancada && i.produzirG > 0 ? r2((g / i.produzirG) * 100) : null,
      consumoPorPessoaG: lancada && pessoasConsumo > 0 ? r0(consumoG / pessoasConsumo) : null,
    };
  });
  const lanc = linhas.filter((l) => l.lancada);
  const comida = lanc.filter((l) => l.un === "g");
  const totalG = r0(comida.reduce((t, l) => t + l.sobraG, 0));
  const produzidoG = comida.reduce((t, l) => t + l.produzirG, 0);
  return {
    linhas, lancadas: lanc.length,
    totalG, totalValor: r2(lanc.reduce((t, l) => t + (l.sobraValor || 0), 0)),
    totalPct: produzidoG > 0 ? r2((totalG / produzidoG) * 100) : null,
    // sugestão para o próximo: produzir o que foi consumido + a sobra de segurança de hoje
    ajustes: lanc.filter((l) => l.porPessoaG > 0 && l.consumoPorPessoaG !== null && l.sobraPct > 15)
      .map((l) => ({ id: l.id, nome: l.nome, de: l.porPessoaG, para: l.consumoPorPessoaG, un: l.un })),
  };
}

function brl(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
