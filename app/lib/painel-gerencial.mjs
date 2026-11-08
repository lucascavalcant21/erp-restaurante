// PAINEL GERENCIAL (pedido do dono, 08/11/2026): a "Visão geral" no modelo de
// dashboard de gestão — maiores margens, custos fixos em rosca, análise do
// produto, faturamento × custos fixos, custo operacional por dia/hora/minuto e
// ponto de equilíbrio sem e com lucro. Serve a Marmitaria e os Eventos; cada um
// entrega os próprios números (cardápio, vendas, orçamentos).
//
// Funções puras e determinísticas (testes em painel-gerencial.test.mjs).
// Sem dado não há número: o campo vem null e `faltando` diz o que falta.

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(typeof v === "string" && v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  return Number.isFinite(n) ? n : null;
};
const positivo = (v) => { const n = num(v); return n !== null && n > 0 ? n : null; };

/**
 * Quanto custa manter a operação aberta: o custo do mês (equipe + custos fixos)
 * dividido pelos dias de operação e, com as horas abertas por dia, por hora e
 * por minuto. ESTIMATIVA.
 */
export function custoOperacional({ custoMes = null, diasMes = null, horasDia = null } = {}) {
  const mes = num(custoMes);
  const dias = positivo(diasMes);
  const horas = positivo(horasDia);
  const faltando = [];
  if (mes === null || !(mes > 0)) faltando.push("equipe e custos fixos do mês");
  if (dias === null) faltando.push("dias de operação no mês");
  if (faltando.length) return { ok: false, mes: mes ?? null, dia: null, hora: null, minuto: null, faltando };
  const dia = r2(mes / dias);
  const hora = horas === null ? null : r2(mes / dias / horas);
  const minuto = horas === null ? null : r2(mes / dias / horas / 60);
  return { ok: true, mes: r2(mes), dia, hora, minuto, faltando: horas === null ? ["horas de operação por dia"] : [] };
}

/**
 * Ponto de equilíbrio em unidades (marmitas, eventos…):
 * - sem lucro (PEC): quantas vendas pagam os custos fixos do mês;
 * - com lucro (PEE): quantas vendas pagam os custos fixos E deixam, em cada
 *   venda, o lucro-meta. n·contribuição − fixos = n·meta → n = fixos ÷ (contribuição − meta).
 * contribuicao e ticket são por unidade; lucroMetaPorUnidade em reais.
 */
export function pontosDeEquilibrio({ custoFixoMes = null, contribuicao = null, ticket = null, lucroMetaPorUnidade = null, diasMes = null } = {}) {
  const fixos = num(custoFixoMes);
  const c = num(contribuicao);
  const t = positivo(ticket);
  const dias = positivo(diasMes);
  const faltando = [];
  if (fixos === null || !(fixos > 0)) faltando.push("equipe e custos fixos do mês");
  if (c === null) faltando.push("itens com preço e custo completos");
  if (faltando.length) return { ok: false, motivo: `Falta informar: ${faltando.join(", ")}.`, sem: null, com: null };
  if (!(c > 0)) return { ok: false, motivo: "Cada venda não cobre os próprios custos variáveis: revise preço, custo e taxas.", sem: null, com: null };
  const ponto = (unidadesMes) => ({
    unidadesMes,
    unidadesDia: dias === null ? null : Math.ceil(unidadesMes / dias),
    faturamentoMes: t === null ? null : r2(unidadesMes * t),
    faturamentoDia: t === null || dias === null ? null : r2((unidadesMes * t) / dias),
  });
  const sem = ponto(Math.ceil(fixos / c - 1e-9));
  const meta = positivo(lucroMetaPorUnidade);
  let com = null;
  let motivoCom = null;
  if (meta === null) motivoCom = "Defina a meta de lucro por venda para ver o ponto de equilíbrio com lucro.";
  else if (!(c - meta > 0)) motivoCom = "A meta de lucro por venda é maior que a contribuição de cada venda: com esse preço ela não é alcançável.";
  else com = { ...ponto(Math.ceil(fixos / (c - meta) - 1e-9)), lucroMetaPorUnidade: r2(meta) };
  return { ok: true, motivo: null, contribuicao: r2(c), ticket: t, sem, com, motivoCom };
}

/**
 * Faturamento × custos fixos do mês. O resultado é o que sobra da contribuição
 * (faturamento − custos variáveis) depois dos custos fixos. As larguras (0–100)
 * desenham as duas barras na mesma escala.
 */
export function faturamentoContraFixos({ faturamento = null, contribuicao = null, custosFixos = null } = {}) {
  const f = num(faturamento);
  const fx = num(custosFixos);
  const c = num(contribuicao);
  const maior = Math.max(f || 0, fx || 0);
  const largura = (v) => (v === null || !(maior > 0) ? 0 : Math.max(0, Math.min(100, Math.round((v / maior) * 1000) / 10)));
  const resultado = c !== null && fx !== null ? r2(c - fx) : null;
  return {
    faturamento: f === null ? null : r2(f), custosFixos: fx === null ? null : r2(fx), contribuicao: c === null ? null : r2(c), resultado,
    larguraFaturamento: largura(f), larguraFixos: largura(fx),
    coberturaPct: c !== null && fx > 0 ? r2((c / fx) * 100) : null,
    faltando: [f === null && "faturamento", fx === null && "custos fixos", c === null && "custos variáveis das vendas"].filter(Boolean),
  };
}

/**
 * Fatias da rosca: do maior para o menor, com o percentual. Acima de `maximo`
 * fatias, as menores viram "Outros". Linhas sem valor positivo ficam de fora.
 */
export function fatiasDeCusto(linhas = [], { maximo = 5 } = {}) {
  const validas = (linhas || []).map((l) => ({ rotulo: String(l?.rotulo ?? l?.nome ?? "").trim() || "Sem nome", valor: num(l?.valor) }))
    .filter((l) => l.valor !== null && l.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const total = validas.reduce((t, l) => t + l.valor, 0);
  if (!(total > 0)) return { total: 0, fatias: [] };
  let lista = validas;
  if (validas.length > maximo) {
    const resto = validas.slice(maximo - 1);
    lista = [...validas.slice(0, maximo - 1), { rotulo: "Outros", valor: resto.reduce((t, l) => t + l.valor, 0), agrupadas: resto.length }];
  }
  // Percentuais com uma casa; a última fatia fecha 100% para a rosca não ter fresta.
  let acumulado = 0;
  const fatias = lista.map((l, i) => {
    const pct = i === lista.length - 1 ? r2(100 - acumulado) : Math.round((l.valor / total) * 1000) / 10;
    acumulado = r2(acumulado + pct);
    return { ...l, valor: r2(l.valor), pct };
  });
  return { total: r2(total), fatias };
}

/** Os N maiores por um campo numérico (itens sem o número ficam de fora). */
export function maioresPor(itens = [], campo, limite = 5) {
  return (itens || []).filter((i) => num(i?.[campo]) !== null).sort((a, b) => num(b[campo]) - num(a[campo])).slice(0, limite);
}

/** Altura (0–100) de cada barra do gráfico, na escala do maior valor absoluto. */
export function alturasDasBarras(valores = []) {
  const maior = Math.max(0, ...valores.map((v) => Math.abs(num(v) || 0)));
  return valores.map((v) => (num(v) === null || !(maior > 0) ? 0 : Math.max(4, Math.round((Math.abs(num(v)) / maior) * 100))));
}

/**
 * Análise de um item do cardápio da Marmitaria, a partir da linha do Cardápio
 * (useCardapio): venda, custo, contribuição, margem de contribuição e lucro.
 */
export function analiseDoPrato(linha) {
  const r = linha?.sim?.com;
  if (!linha || linha.semPreco || !r?.valido || r.custo == null) return null;
  const contribuicao = r.margemContribuicao ?? (r.lucro == null ? null : r2((num(r.lucro) || 0) + (num(r.cmo) || 0) + (num(r.fixos) || 0)));
  return {
    id: linha.id, nome: linha.nome, foto: linha.ficha?.imagem || null,
    venda: r2(r.preco), custo: r2(r.custo), contribuicao: contribuicao === null ? null : r2(contribuicao),
    margemContribuicaoPct: contribuicao !== null && r.preco > 0 ? r2((contribuicao / r.preco) * 100) : null,
    lucro: linha.lucro == null ? null : r2(linha.lucro), lucroPct: linha.lucroPct == null ? null : r2(linha.lucroPct),
    cmvPct: linha.cmvPct == null ? null : r2(linha.cmvPct),
  };
}

const etapa = (e) => String(e?.funil_status || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() || "NOVO CONTATO";

/**
 * Análise de um evento a partir do resumo gravado pelo orçamento
 * (operacao_detalhes.resumo). Custo direto = cardápio + equipe + aluguel/extras;
 * contribuição = receita − custo direto − impostos/taxas/comissões.
 */
export function analiseDoEvento(evento) {
  const r = evento?.operacao_detalhes?.resumo;
  const receita = positivo(r?.receita);
  if (!r || receita === null) return null;
  const cmv = num(r.cmv);
  const temComposicao = cmv !== null;
  const custoDireto = temComposicao ? r2((cmv || 0) + (num(r.equipe) || 0) + (num(r.extras) || 0)) : null;
  const contribuicao = custoDireto === null ? null : r2(receita - custoDireto - (num(r.taxas) || 0));
  const lucro = num(r.lucro);
  return {
    id: evento.id, nome: evento.nome || "Evento", data: evento.data_evento || null, etapa: etapa(evento),
    venda: r2(receita), custo: custoDireto, contribuicao,
    margemContribuicaoPct: contribuicao === null ? null : r2((contribuicao / receita) * 100),
    lucro: lucro === null ? null : r2(lucro), lucroPct: lucro === null ? null : r2((lucro / receita) * 100),
    cmv, equipe: num(r.equipe), extras: num(r.extras), taxas: num(r.taxas), prolabore: num(r.prolabore),
    metaLucro: num(r.meta_lucro),
  };
}
