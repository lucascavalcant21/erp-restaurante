// Composição do preço de venda — FONTE ÚNICA. O card das Fichas Técnicas e a
// Pizza do Lucro montam a divisão do preço daqui; nenhuma tela refaz a conta.
// Funções puras (testes em composicao-preco.test.mjs).
//
//   PREÇO DE VENDA                                   100%
//   (−) CMV ...................... ingredientes, insumos e embalagem da ficha
//   (−) DESPESAS VARIÁVEIS ........ imposto, maquininha, comissão, marketplace,
//                                    outras — % configurado sobre a venda
//   (=) MARGEM DE CONTRIBUIÇÃO ..... o que sobra para pagar o resto (NÃO é lucro)
//   (−) CMO rateado ................ folha, extras e encargos do mês (RH)
//   (−) DESPESAS OPERACIONAIS ...... aluguel, energia, água, internet... do mês
//   (−) PRÓ-LABORE rateado ......... retirada dos sócios — não é lucro nem CMO
//   (=) RESULTADO ESTIMADO
//
// Todo valor sai em R$ e em % do preço de venda. Os custos do mês entram no
// produto por RATEIO, e saem marcados como rateados: não são custo direto do
// prato. O rateio segue o método configurado:
//   por prato ........ custo do mês ÷ (dias de operação × pratos por dia)
//   por faturamento .. custo do mês ÷ faturamento do mês × preço do produto
//
// Arredondamento: cada grupo é o total exato arredondado em centavos; as
// partes são repartidas para somar exatamente o grupo; o resultado é o que
// sobra do preço. Assim CMV + variáveis + CMO + operacionais + pró-labore +
// resultado = preço, no centavo. Os percentuais são sempre valor ÷ preço.

import { percentualDe, diferencaPP, NATUREZA } from "./valor-percentual.mjs";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pos = (v) => Math.max(0, num(v));
// toFixed antes do round: 2,925 × 100 dá 292,4999… em ponto flutuante.
const centavos = (v) => Math.round(Number((num(v) * 100).toFixed(6)));

// ─── Cadastros do mês ───────────────────────────────────────────────────────

// Despesas operacionais do mês, informadas em Financeiro → Pizza do Lucro e
// gravadas em config_sistema.params. Lista única: a Pizza, o custo por dia e
// este rateio leem daqui.
export const DESPESAS_OPERACIONAIS = [
  ["custo_aluguel_mes", "Aluguel"],
  ["custo_luz_mes", "Energia"],
  ["custo_gas_mes", "Gás"],
  ["custo_agua_mes", "Água"],
  ["custo_limpeza_mes", "Limpeza"],
  ["custo_internet_mes", "Internet"],
  ["custo_contabilidade_mes", "Contabilidade"],
  ["custo_sistemas_mes", "Sistemas"],
  ["custo_manutencao_mes", "Manutenção"],
  ["custo_seguros_mes", "Seguros"],
  ["custo_outros_mes", "Outras despesas"],
];

// Despesas que acompanham cada venda, em % do preço.
export const DESPESAS_VARIAVEIS = [
  ["imposto_pct", "Impostos"],
  ["taxa_cartao_pct", "Maquininha"],
  ["comissao_pct", "Comissão"],
  ["marketplace_pct", "Marketplace / iFood"],
  ["outras_variaveis_pct", "Outras despesas variáveis"],
];

// CMO do mês: o retrato gravado pela Pizza do Lucro a partir do RH (folha dos
// contratados, diárias pagas de extras) mais os encargos configurados.
export function cmoDoMes(params = {}) {
  const folha = pos(params.cmo_folha_mes);
  const extras = pos(params.cmo_extras_mes);
  const encargos = pos(params.cmo_encargos_mes);
  const total = pos(params.custo_cmo_mes);
  const partes = folha + extras + encargos > 0
    ? [
        { rotulo: "Salários e benefícios (RH)", valor: folha },
        { rotulo: "Extras e diárias pagas", valor: extras },
        { rotulo: "Encargos e provisões (configurado)", valor: encargos },
      ].filter((p) => p.valor > 0)
    : (total > 0 ? [{ rotulo: "Folha e extras (RH)", valor: total }] : []);
  return { total: partes.reduce((t, p) => t + p.valor, 0), partes };
}

// Pró-labore vigente na competência: cada sócio com valor mensal e, se
// informada, a competência (AAAA-MM) a partir da qual vale.
export function proLaboreDoMes(lista = [], referencia = new Date()) {
  const d = new Date(referencia);
  const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const partes = (Array.isArray(lista) ? lista : [])
    .filter((p) => p && pos(p.valor_mensal) > 0)
    .filter((p) => !p.competencia || String(p.competencia).slice(0, 7) <= comp)
    .map((p) => ({ rotulo: String(p.socio || "Sócio").trim() || "Sócio", valor: pos(p.valor_mensal) }));
  return { total: partes.reduce((t, p) => t + p.valor, 0), partes };
}

export function despesasOperacionaisDoMes(params = {}) {
  const partes = DESPESAS_OPERACIONAIS
    .map(([chave, rotulo]) => ({ chave, rotulo, valor: pos(params[chave]) }))
    .filter((p) => p.valor > 0);
  return { total: partes.reduce((t, p) => t + p.valor, 0), partes };
}

// ─── Rateio ─────────────────────────────────────────────────────────────────

export function baseDoRateio(params = {}) {
  if (num(params.rateio_por_faturamento) === 1) {
    const faturamento = pos(params.faturamento_mes_ref);
    return faturamento > 0
      ? { metodo: "faturamento", ok: true, faturamento,
          descricao: "proporcional ao preço: custo do mês ÷ faturamento do mês" }
      : { metodo: "faturamento", ok: false,
          motivo: "Rateio por faturamento sem faturamento mensal de referência: informe-o em Financeiro → Pizza do Lucro." };
  }
  const pratos = pos(params.dias_operacao_mes) * pos(params.pratos_por_dia);
  return pratos > 0
    ? { metodo: "prato", ok: true, pratos,
        descricao: `por prato: custo do mês ÷ ${pratos.toLocaleString("pt-BR")} pratos no mês` }
    : { metodo: "prato", ok: false,
        motivo: "Sem dias de operação e pratos por dia não há rateio: informe-os em Financeiro → Pizza do Lucro." };
}

// Quanto de um custo do mês cabe num produto com este preço.
export function ratear(valorMes, base, preco) {
  if (!base?.ok) return 0;
  return base.metodo === "faturamento" ? (pos(valorMes) / base.faturamento) * pos(preco) : pos(valorMes) / base.pratos;
}

// Percentual do faturamento que um custo do mês representa (CMO % da operação).
export function pesoNoFaturamento(valorMes, faturamentoMes) {
  return percentualDe(valorMes, faturamentoMes);
}

// ─── Repartição em centavos ─────────────────────────────────────────────────

// Arredonda as partes para que somem exatamente `totalC` (maior resto).
function repartir(valores, totalC) {
  const exatos = valores.map((v) => Number((num(v) * 100).toFixed(6)));
  const base = exatos.map((v) => Math.floor(v));
  let falta = totalC - base.reduce((t, v) => t + v, 0);
  const ordem = exatos.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; falta > 0 && ordem.length; k = (k + 1) % ordem.length, falta--) base[ordem[k][1]]++;
  for (let k = 0; falta < 0 && ordem.length; k = (k + 1) % ordem.length, falta++) base[ordem[ordem.length - 1 - k][1]]--;
  return base;
}

function grupo(id, rotulo, natureza, partesExatas, preco, extra = {}) {
  const totalC = centavos(partesExatas.reduce((t, p) => t + num(p.valor), 0));
  const cents = repartir(partesExatas.map((p) => p.valor), totalC);
  const partes = partesExatas.map((p, i) => ({
    ...p, valor: cents[i] / 100, pct: percentualDe(cents[i] / 100, preco), natureza: p.natureza || natureza,
  })).filter((p) => p.valor !== 0);
  return { id, rotulo, natureza, valor: totalC / 100, centavos: totalC, pct: percentualDe(totalC / 100, preco), partes, ...extra };
}

// ─── A composição ───────────────────────────────────────────────────────────

/* Entradas:
 *   preco ............. preço de venda do produto
 *   cmvItens .......... [{ rotulo, valor, detalhe? }] — custo por porção de cada
 *                       ingrediente/insumo/embalagem (já com a perda)
 *   impostoPct,
 *   taxaMaquininhaPct . os da ficha/produto, quando houver; senão os da casa
 *   params ............ config_sistema.params (despesas, CMO, rateio, meta,
 *                       pro_labore)
 */
export function composicaoDoPreco({
  preco = 0, cmvItens = [], impostoPct = null, taxaMaquininhaPct = null, params = {}, referencia = new Date(),
} = {}) {
  const p = pos(preco);
  const temPreco = p > 0;

  const cmv = grupo("cmv", "CMV", NATUREZA.calculado.id,
    (cmvItens || []).map((i) => ({ rotulo: i.rotulo, detalhe: i.detalhe || null, valor: pos(i.valor) })), p);

  const taxas = {
    ...Object.fromEntries(DESPESAS_VARIAVEIS.map(([k]) => [k, pos(params[k])])),
    ...(impostoPct !== null && impostoPct !== undefined ? { imposto_pct: pos(impostoPct) } : {}),
    ...(taxaMaquininhaPct !== null && taxaMaquininhaPct !== undefined ? { taxa_cartao_pct: pos(taxaMaquininhaPct) } : {}),
  };
  const variaveis = grupo("variaveis", "Despesas variáveis", NATUREZA.configurado.id,
    DESPESAS_VARIAVEIS.filter(([k]) => taxas[k] > 0)
      .map(([k, rotulo]) => ({ rotulo, taxaPct: taxas[k], valor: (p * taxas[k]) / 100 })), p);

  const margemC = Math.round(p * 100) - cmv.centavos - variaveis.centavos;

  const base = baseDoRateio(params);
  const rateado = (lista) => lista.map((x) => ({ ...x, valor: ratear(x.valor, base, p), valorMes: x.valor }));
  const cmoMes = cmoDoMes(params);
  const operMes = despesasOperacionaisDoMes(params);
  const plMes = proLaboreDoMes(params.pro_labore, referencia);
  const semCadastro = (mes, texto) => (base.ok && mes.total === 0 ? texto : null);

  const cmo = grupo("cmo", "CMO rateado", NATUREZA.rateado.id, rateado(cmoMes.partes), p, {
    valorMes: cmoMes.total, motivo: base.ok ? semCadastro(cmoMes, "Sem CMO do mês: salve os custos em Financeiro → Pizza do Lucro (o CMO vem do RH).") : base.motivo,
  });
  const operacionais = grupo("operacionais", "Despesas operacionais rateadas", NATUREZA.rateado.id, rateado(operMes.partes), p, {
    valorMes: operMes.total, motivo: base.ok ? semCadastro(operMes, "Nenhuma despesa operacional cadastrada em Financeiro → Pizza do Lucro.") : base.motivo,
  });
  const proLabore = grupo("proLabore", "Pró-labore rateado", NATUREZA.rateado.id, rateado(plMes.partes), p, {
    valorMes: plMes.total, motivo: base.ok ? semCadastro(plMes, "Nenhum pró-labore cadastrado em Financeiro → Pizza do Lucro.") : base.motivo,
  });

  const resultadoC = margemC - cmo.centavos - operacionais.centavos - proLabore.centavos;
  const resultado = {
    id: "resultado",
    rotulo: base.ok ? "Resultado estimado" : "Resultado antes dos custos rateados",
    natureza: NATUREZA.estimado.id,
    valor: resultadoC / 100,
    centavos: resultadoC,
    pct: percentualDe(resultadoC / 100, p),
    prejuizo: temPreco && resultadoC < 0,
  };

  // Meta de lucro: configuração, nunca resultado. O resultado calculado não
  // é ajustado para ela.
  const metaPct = pos(params.margem_alvo_pct);
  const meta = {
    pct: metaPct > 0 ? metaPct : null,
    natureza: NATUREZA.configurado.id,
    diferencaPP: metaPct > 0 && resultado.pct !== null ? diferencaPP(resultado.pct, metaPct) : null,
  };

  const grupos = [cmv, variaveis, cmo, operacionais, proLabore];
  const custosC = grupos.reduce((t, g) => t + g.centavos, 0);
  const todo = resultadoC < 0 ? custosC : Math.round(p * 100);
  const barra = todo > 0
    ? [...grupos.map((g) => ({ id: g.id, largura: (g.centavos / todo) * 100 })),
       { id: "resultado", largura: resultadoC > 0 ? (resultadoC / todo) * 100 : 0 }].filter((s) => s.largura > 0)
    : [];

  return {
    preco: p,
    temPreco,
    rateio: base,
    cmv, variaveis,
    margemContribuicao: { id: "margem", rotulo: "Margem de contribuição", natureza: NATUREZA.estimado.id,
      valor: margemC / 100, centavos: margemC, pct: percentualDe(margemC / 100, p) },
    cmo, operacionais, proLabore,
    resultado,
    meta,
    barra,
  };
}

// ─── Visão gerencial do mês ─────────────────────────────────────────────────

/* DRE gerencial: faturamento → CMV → margem → variáveis → CMO → operacionais
 * → pró-labore → resultado, em R$ e % do faturamento. Recebe só números com
 * fonte; o que não tiver fonte vai como null e sai "sem dado" — nunca zero,
 * que pareceria custo nenhum. Cada linha diz a natureza do número.
 */
export function resultadoGerencialDoMes({
  faturamento = null, cmvReal = null, despesasVariaveis = null, cmo = null,
  operacionais = null, proLabore = null,
} = {}) {
  const f = faturamento === null ? null : pos(faturamento);
  const valor = (v) => (v === null || v === undefined ? null : pos(v));
  const linha = (id, rotulo, v, natureza) => ({ id, rotulo, valor: v, pct: v === null || !f ? null : percentualDe(v, f), natureza });
  const cmvV = valor(cmvReal), varV = valor(despesasVariaveis), cmoV = valor(cmo), opV = valor(operacionais), plV = valor(proLabore);
  const sub = (...vs) => (f === null || vs.some((v) => v === null) ? null : Math.round((f - vs.reduce((t, v) => t + v, 0)) * 100) / 100);
  const margem = sub(cmvV);
  const contribuicao = sub(cmvV, varV);
  const resultado = sub(cmvV, varV, cmoV, opV, plV);
  return [
    linha("faturamento", "Faturamento", f, NATUREZA.real.id),
    linha("cmv", "(−) CMV real", cmvV, NATUREZA.real.id),
    linha("margem_bruta", "(=) Margem bruta", margem, NATUREZA.estimado.id),
    linha("variaveis", "(−) Despesas variáveis", varV, NATUREZA.configurado.id),
    linha("contribuicao", "(=) Margem de contribuição", contribuicao, NATUREZA.estimado.id),
    linha("cmo", "(−) CMO", cmoV, NATUREZA.real.id),
    linha("operacionais", "(−) Despesas operacionais", opV, NATUREZA.real.id),
    linha("pro_labore", "(−) Pró-labore", plV, NATUREZA.configurado.id),
    linha("resultado", "(=) Resultado", resultado, NATUREZA.estimado.id),
  ];
}
