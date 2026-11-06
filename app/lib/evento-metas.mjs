// Metas dos eventos (pedido do dono, 06/11/2026): a mesma lógica da Marmitaria e
// do Restaurante — o que importa é o lucro no bolso. Para eventos, o mês se mede
// pelo que já está contratado (eventos fechados com data no mês), com o lucro
// gravado pelo orçamento de cada evento (operacao_detalhes.resumo).
// Função pura: sem banco. Sem orçamento gravado não há lucro: devolve null e o motivo.

import { FECHADO } from "./evento-orcamento.mjs";
import { parseNumero } from "./ficha-calculos.mjs";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
// Mesma leitura de número do resto do sistema; em branco é "sem valor", não zero.
const num = (v) => (v === "" || v === null || v === undefined ? null : parseNumero(v));
const etapaDe = (e) => String(e?.funil_status || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() || "NOVO CONTATO";
const fechado = (e) => FECHADO.includes(etapaDe(e));
const cancelado = (e) => etapaDe(e) === "CANCELADO";
const resumoDe = (e) => e?.operacao_detalhes?.resumo || null;
const lucroDe = (e) => (typeof resumoDe(e)?.lucro === "number" ? resumoDe(e).lucro : null);
const faturamentoDe = (e) => {
  const v = num(e?.valor_contratado);
  if (v !== null && v > 0) return v;
  const r = resumoDe(e)?.receita;
  return typeof r === "number" && r > 0 ? r : 0;
};

/** Atual × meta: percentual, quanto falta e quanto passou (margem de segurança). */
export function contraMeta(atual, meta) {
  const m = num(meta);
  if (m === null || !(m > 0)) return { meta: null, atual, pct: null, falta: null, margem: null, atingida: null };
  if (atual === null || atual === undefined) return { meta: m, atual: null, pct: null, falta: null, margem: null, atingida: null };
  const d = r2(atual - m);
  return { meta: m, atual: r2(atual), pct: r2((atual / m) * 100), falta: d < 0 ? r2(-d) : 0, margem: d > 0 ? d : 0, atingida: d >= -0.005 };
}

const somaLucro = (lista) => {
  const com = lista.filter((e) => lucroDe(e) !== null);
  return { lucro: com.length ? r2(com.reduce((t, e) => t + lucroDe(e), 0)) : null, comLucro: com.length, semOrcamento: lista.length - com.length };
};

/**
 * eventos: linhas da tabela eventos. mes: "AAAA-MM". metas em reais por mês.
 * Devolve o contratado do mês e do ano contra as metas, quantos eventos faltam
 * (pelo lucro médio do mês), o que está em negociação, os eventos abaixo da meta
 * e para onde vai o dinheiro dos eventos fechados.
 */
export function metasDosEventos(eventos = [], { mes, metaLucroMes = null, metaFaturamentoMes = null } = {}) {
  const lista = Array.isArray(eventos) ? eventos : [];
  const ano = String(mes || "").slice(0, 4);
  const doMes = lista.filter((e) => String(e.data_evento || "").slice(0, 7) === mes && !cancelado(e));
  const fechadosMes = doMes.filter(fechado);
  const abertosMes = doMes.filter((e) => !fechado(e));

  const { lucro, comLucro, semOrcamento } = somaLucro(fechadosMes);
  const faturamento = r2(fechadosMes.reduce((t, e) => t + faturamentoDe(e), 0));
  const lucroMedio = comLucro ? r2(lucro / comLucro) : null;
  const ticketMedio = fechadosMes.length ? r2(faturamento / fechadosMes.length) : null;

  const metaLucro = contraMeta(lucro, metaLucroMes);
  const metaFaturamento = contraMeta(faturamento, metaFaturamentoMes);
  // Quantos eventos parecidos com os do mês ainda faltam para a meta.
  const eventosParaLucro = metaLucro.falta > 0 && lucroMedio > 0 ? Math.ceil(metaLucro.falta / lucroMedio - 1e-9) : metaLucro.falta === 0 ? 0 : null;
  const eventosParaFaturamento = metaFaturamento.falta > 0 && ticketMedio > 0 ? Math.ceil(metaFaturamento.falta / ticketMedio - 1e-9) : metaFaturamento.falta === 0 ? 0 : null;

  // Em negociação: o que entra se as propostas do mês fecharem.
  const negociacao = abertosMes.map((e) => ({
    id: e.id, nome: e.nome || "Evento", data: e.data_evento, etapa: etapaDe(e),
    faturamento: faturamentoDe(e) || null, lucro: lucroDe(e),
  }));
  const potencial = somaLucro(abertosMes);

  // Eventos fechados abaixo da meta de lucro gravada no orçamento (ou com prejuízo).
  const abaixoDaMeta = fechadosMes
    .map((e) => ({ id: e.id, nome: e.nome || "Evento", data: e.data_evento, lucro: lucroDe(e), meta: typeof resumoDe(e)?.meta_lucro === "number" ? resumoDe(e).meta_lucro : null }))
    .filter((x) => x.lucro !== null && (x.lucro < 0 || (x.meta !== null && x.lucro < x.meta - 0.005)))
    .map((x) => ({ ...x, falta: x.meta !== null ? r2(x.meta - x.lucro) : null, prejuizo: x.lucro < 0 }))
    .sort((a, b) => (b.falta ?? Infinity) - (a.falta ?? Infinity));

  // Para onde vai o dinheiro: só eventos cujo resumo traz a composição.
  const comComposicao = fechadosMes.map(resumoDe).filter((r) => r && typeof r.receita === "number" && r.receita > 0 && typeof r.cmv === "number");
  const receitaComp = r2(comComposicao.reduce((t, r) => t + r.receita, 0));
  const fatia = (campo) => r2(comComposicao.reduce((t, r) => t + (Number(r[campo]) || 0), 0));
  const composicao = receitaComp > 0 ? [
    { id: "cmv", rotulo: "Cardápio (CMV)", valor: fatia("cmv") },
    { id: "equipe", rotulo: "Equipe", valor: fatia("equipe") },
    { id: "extras", rotulo: "Aluguel e extras", valor: fatia("extras") },
    { id: "taxas", rotulo: "Impostos, taxas e comissões", valor: fatia("taxas") },
    { id: "prolabore", rotulo: "Pró-labore", valor: fatia("prolabore") },
    { id: "lucro", rotulo: "Lucro líquido", valor: fatia("lucro") },
  ].map((c) => ({ ...c, pct: r2((c.valor / receitaComp) * 100) })) : null;
  const maiorCusto = composicao ? composicao.filter((c) => c.id !== "lucro").sort((a, b) => b.valor - a.valor)[0] : null;

  // Ano: mês a mês, o contratado; a meta do ano é a do mês × 12.
  const doAno = lista.filter((e) => String(e.data_evento || "").slice(0, 4) === ano && !cancelado(e) && fechado(e));
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const fs = doAno.filter((e) => String(e.data_evento || "").slice(0, 7) === m);
    return { mes: m, eventos: fs.length, faturamento: r2(fs.reduce((t, e) => t + faturamentoDe(e), 0)), lucro: somaLucro(fs).lucro };
  });
  const lucroAno = somaLucro(doAno);
  const metaMes = num(metaLucroMes);
  const metaFatMes = num(metaFaturamentoMes);

  return {
    mes, ano,
    eventos: doMes.length,
    fechados: fechadosMes.length,
    semOrcamento, // fechados sem orçamento gravado: o lucro deles não entra
    faturamento, lucro, lucroMedio, ticketMedio,
    metaLucro: { ...metaLucro, eventosQueFaltam: eventosParaLucro },
    metaFaturamento: { ...metaFaturamento, eventosQueFaltam: eventosParaFaturamento },
    negociacao,
    potencialLucro: potencial.lucro,
    potencialFaturamento: r2(abertosMes.reduce((t, e) => t + faturamentoDe(e), 0)),
    abaixoDaMeta,
    composicao, maiorCusto, eventosNaComposicao: comComposicao.length,
    anoResumo: {
      lucro: lucroAno.lucro, faturamento: r2(doAno.reduce((t, e) => t + faturamentoDe(e), 0)), eventos: doAno.length,
      metaLucro: contraMeta(lucroAno.lucro, metaMes > 0 ? metaMes * 12 : null),
      metaFaturamento: contraMeta(r2(doAno.reduce((t, e) => t + faturamentoDe(e), 0)), metaFatMes > 0 ? metaFatMes * 12 : null),
      meses,
    },
  };
}
