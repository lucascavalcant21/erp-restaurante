// RESULTADO DO MÊS (pedido do dono, 27/10/2026, no lugar da Pizza do Lucro):
// "ponho meu faturamento do mês, meus custos fixos e variáveis, um por um, e
// posso criar e excluir subcustos; o CMO vem do RH e o CMV da contagem de
// estoque semanal (média mensal); ponho imposto, taxa de cartão entre crédito
// e débito, depreciação de equipamentos, manutenção e outros; mostra do lucro
// bruto ao lucro líquido, com a porcentagem de cada custo e do lucro".
//
// Regras puras (testes em resultado-mes.test.mjs). Natureza dos números:
// faturamento e custos digitados = INFORMADO pelo dono; CMO = REAL (RH);
// CMV = REAL quando as contagens cobrem o mês, senão ESTIMATIVA (média
// diária das contagens × dias do mês). Sem dado: DADOS INSUFICIENTES.

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/\./g, (m, i, t) => (String(t).includes(",") ? "" : m)).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const pct = (v, base) => (base > 0 ? r2((v / base) * 100) : null);
let seq = 0;
export const novoIdResultado = (p = "i") => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const GRUPOS = [
  { id: "variaveis", rotulo: "Custos variáveis", ajuda: "Mudam com as vendas: embalagens, comissão de app, marketing, gás…" },
  { id: "fixos", rotulo: "Custos fixos", ajuda: "Todo mês, vendendo ou não: aluguel, energia, água, internet, contador, sistema…" },
  { id: "outros", rotulo: "Manutenção e outras despesas", ajuda: "Manutenção de equipamentos, reformas pequenas e o que mais você quiser separar." },
];

/** Estrutura inicial: só os nomes (valores vazios — nada inventado). */
export function modeloInicial() {
  const it = (nome) => ({ id: novoIdResultado(), nome, valor: "", subitens: [] });
  return {
    faturamento: "",
    impostos_pct: "",
    cartao: { parte_credito_pct: "", parte_debito_pct: "", taxa_credito_pct: "", taxa_debito_pct: "" },
    encargos_pct: "",
    bonus_funcionario: "",
    pedidos: "",
    // Taxa de serviço lançada no fim do mês, por funcionário: { id: valor }.
    taxas_servico: {},
    // Dias que a casa abre no mês: base do custo por dia e da venda mínima por dia.
    dias_abertos: "",
    itens: {
      variaveis: [it("Embalagens e descartáveis"), it("Comissão de aplicativos (iFood…)"), it("Gás"), it("Marketing")],
      fixos: [it("Aluguel"), it("Energia"), it("Água"), it("Internet e telefone"), it("Contador"), it("Sistemas")],
      outros: [it("Manutenção de equipamentos")],
    },
    depreciacao: [],
    cmv_manual: "",
  };
}

/** Copia a estrutura de um mês para outro (mesmos nomes e valores, novos ids não são necessários). */
export const copiarMes = (m) => JSON.parse(JSON.stringify(m));

/* Mês ainda não salvo: começa igual ao último mês salvo antes dele — custos,
 * faturamento e a taxa de serviço de cada funcionário ficam valendo até o
 * dono lançar os novos (pedido do dono, 27/10/2026). Só o CMV informado à mão
 * não passa (o CMV vem das contagens de cada mês). */
export function mesHerdado(todos = {}, mes) {
  if (todos[mes]) return { modelo: copiarMes(todos[mes]), herdadoDe: null };
  const ult = Object.keys(todos).filter((k) => k < mes).sort().pop();
  if (!ult) return { modelo: modeloInicial(), herdadoDe: null };
  return { modelo: { ...copiarMes(todos[ult]), cmv_manual: "" }, herdadoDe: ult };
}

/** Valor do item: a soma dos subcustos, se houver; senão o valor digitado. */
export const valorDoItem = (it) => (Array.isArray(it?.subitens) && it.subitens.length ? r2(it.subitens.reduce((s, x) => s + num(x.valor), 0)) : r2(num(it?.valor)));

/** Depreciação mensal: valor do bem ÷ vida útil em meses. */
export const depreciacaoMensal = (d) => (num(d?.valor_bem) > 0 && num(d?.vida_meses) > 0 ? r2(num(d.valor_bem) / num(d.vida_meses)) : 0);

/**
 * CMV do mês a partir das contagens de estoque (períodos já apurados por
 * apurarPeriodo, cmv-real.mjs). Média diária dos períodos que tocam o mês
 * (ou, sem nenhum, dos últimos 4 apurados) × dias do mês.
 * @param {Array<{periodo:{de, ateExclusivo, dias}, status, cmv:{valor}}>} apurados
 */
export function cmvDoMes(apurados = [], mes) {
  const [a, m] = String(mes).split("-").map(Number);
  if (!a || !m) return { valor: null, natureza: "DADOS INSUFICIENTES", motivo: "Mês inválido." };
  const diasMes = new Date(a, m, 0).getDate();
  const ini = `${mes}-01`;
  const fimEx = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const ok = (apurados || []).filter((p) => p?.status === "apurado" && p.cmv?.valor != null && p.periodo?.dias > 0);
  if (!ok.length) return { valor: null, natureza: "DADOS INSUFICIENTES", motivo: "Nenhum período de estoque apurado: feche duas contagens seguidas (inventário) para ter o CMV." };
  const noMes = ok.filter((p) => p.periodo.de < fimEx && p.periodo.ateExclusivo > ini);
  const base = noMes.length ? noMes : [...ok].sort((x, y) => String(y.periodo.de).localeCompare(String(x.periodo.de))).slice(0, 4);
  const dias = base.reduce((s, p) => s + p.periodo.dias, 0);
  const total = base.reduce((s, p) => s + Number(p.cmv.valor), 0);
  const porDia = total / dias;
  // Cobre o mês inteiro quando os períodos vão do dia 1 ao último dia.
  const cobre = noMes.length > 0 && noMes.some((p) => p.periodo.de <= ini) && noMes.some((p) => p.periodo.ateExclusivo >= fimEx)
    && noMes.reduce((s, p) => s + p.periodo.dias, 0) >= diasMes;
  return {
    valor: r2(porDia * diasMes),
    porDia: r2(porDia),
    natureza: cobre ? "REAL" : "ESTIMATIVA",
    periodos: base.length,
    dias,
    motivo: `${cobre ? "Contagens cobrem o mês" : "Média diária"} de ${base.length} período(s) entre contagens (${dias} dias) × ${diasMes} dias${noMes.length ? "" : " (nenhum período neste mês: últimos apurados)"}.`,
  };
}

/**
 * Custo da equipe no mês, pessoa por pessoa (pedido do dono, 27/10/2026:
 * "salário fixo, bônus de R$ 400 e taxa de serviço que varia por funcionário,
 * tudo junto no custo dele por dia"). Do RH: salário, vale-alimentação,
 * vale-transporte (se usa) e taxa de serviço do mês de cada um. Informado pelo
 * dono: bônus mensal por funcionário e % de encargos sobre o salário. Extras
 * (freelancer): diárias pagas no mês (cmo.mjs).
 */
// taxas: { idDoColaborador: valor } — a taxa de serviço que o dono lança no fim
// do mês para cada um; sem lançamento, vale a do cadastro do RH.
export function equipeDoMes(colaboradores = [], { bonus = 0, encargos_pct = 0, dias = 0, extrasPagos = 0, taxas = {} } = {}) {
  const b = num(bonus); const enc = num(encargos_pct);
  const pessoas = (colaboradores || [])
    .filter((c) => c && String(c.tipo_contrato || "") !== "Freelancer" && (c.status || "ativo") !== "inativo" && c.ativo !== false)
    .map((c) => {
      const salario = r2(Number(c.salario) || 0);
      const vale = r2((Number(c.vale_alimentacao) || 0) + (c.usa_vale_transporte ? Number(c.vale_transporte_val) || 0 : 0));
      const lancada = taxas && Object.prototype.hasOwnProperty.call(taxas, c.id) && taxas[c.id] !== "";
      const taxa = r2(lancada ? num(taxas[c.id]) : Number(c.taxa_servico_mes) || 0);
      const encargos = r2(salario * enc / 100);
      const total = r2(salario + vale + taxa + b + encargos);
      return { id: c.id, nome: c.nome || "Sem nome", cargo: c.cargo || "", salario, vale, taxaServico: taxa, taxaDoRh: !lancada, bonus: r2(b), encargos, total, porDia: dias > 0 ? r2(total / dias) : null };
    })
    .sort((x, y) => y.total - x.total);
  const soma = (k) => r2(pessoas.reduce((t, p) => t + p[k], 0));
  const extras = r2(num(extrasPagos));
  const total = r2(soma("total") + extras);
  return {
    pessoas, salarios: soma("salario"), vales: soma("vale"), taxaServico: soma("taxaServico"), bonus: soma("bonus"), encargos: soma("encargos"), extras,
    total, porDia: dias > 0 ? r2(total / dias) : null,
  };
}

/**
 * DRE do mês./**
 * DRE do mês. Tudo em R$ e em % do faturamento.
 *   Faturamento
 *   (−) Impostos, (−) Taxa de cartão (crédito e débito)
 *   (=) Receita líquida
 *   (−) CMV
 *   (=) Lucro bruto
 *   (−) CMO (folha + extras + encargos), (−) Custos variáveis
 *   (=) Margem de contribuição
 *   (−) Custos fixos, (−) Manutenção e outras
 *   (=) Resultado antes da depreciação
 *   (−) Depreciação
 *   (=) Lucro líquido
 * @param {object} modelo do mês (modeloInicial)
 * @param {{cmv:{valor,natureza,motivo}, cmo:{folha,extras,total}|null}} fontes
 */
export function calcularResultado(modelo = {}, { cmv = null, cmo = null } = {}) {
  const fat = r2(num(modelo.faturamento));
  const dias = Math.round(num(modelo.dias_abertos));
  const porDia = (v) => (v == null || !(dias > 0) ? null : r2(v / dias));
  const L = [];
  const comDia = (x) => ({ ...x, porDia: porDia(x.valor) });
  const add = (id, rotulo, valor, tipo = "custo", extra = {}) => {
    const l = { id, rotulo, valor: valor == null ? null : r2(valor), pct: valor == null ? null : pct(valor, fat), porDia: porDia(valor), tipo, ...extra };
    if (l.itens) l.itens = l.itens.map((i) => ({ ...comDia(i), subitens: (i.subitens || []).map(comDia) }));
    if (l.detalhe) l.detalhe = l.detalhe.map(comDia);
    L.push(l); return l;
  };

  const impostos = r2(fat * num(modelo.impostos_pct) / 100);
  const c = modelo.cartao || {};
  const credito = r2(fat * num(c.parte_credito_pct) / 100 * num(c.taxa_credito_pct) / 100);
  const debito = r2(fat * num(c.parte_debito_pct) / 100 * num(c.taxa_debito_pct) / 100);
  const cartao = r2(credito + debito);
  const receitaLiquida = r2(fat - impostos - cartao);

  const cmvManual = num(modelo.cmv_manual);
  const cmvValor = cmv?.valor != null ? Number(cmv.valor) : cmvManual > 0 ? cmvManual : null;
  const cmvNatureza = cmv?.valor != null ? cmv.natureza : cmvManual > 0 ? "INFORMADO" : "DADOS INSUFICIENTES";
  const lucroBruto = r2(receitaLiquida - (cmvValor || 0));

  // cmo da equipeDoMes (pessoas) já vem com bônus e encargos; o formato antigo (cmo.mjs) soma os encargos aqui.
  const porPessoa = Array.isArray(cmo?.pessoas);
  const cmoBase = cmo ? r2(Number(cmo.total) || 0) : null;
  const encargos = cmo && !porPessoa ? r2((Number(cmo.folha) || 0) * num(modelo.encargos_pct) / 100) : 0;
  const cmoTotal = cmo ? r2(cmoBase + encargos) : null;

  const grupo = (g) => (modelo.itens?.[g] || []).map((it) => ({
    id: it.id, nome: it.nome || "Sem nome", valor: valorDoItem(it), pct: pct(valorDoItem(it), fat),
    subitens: (it.subitens || []).map((s) => ({ id: s.id, nome: s.nome || "Sem nome", valor: r2(num(s.valor)), pct: pct(num(s.valor), fat) })),
  }));
  const variaveis = grupo("variaveis"); const fixos = grupo("fixos"); const outros = grupo("outros");
  const soma = (l) => r2(l.reduce((s, x) => s + x.valor, 0));
  const tVar = soma(variaveis); const tFix = soma(fixos); const tOut = soma(outros);
  const deprec = (modelo.depreciacao || []).map((d) => ({ id: d.id, nome: d.nome || "Equipamento", valor: depreciacaoMensal(d), pct: pct(depreciacaoMensal(d), fat) }));
  const tDep = soma(deprec);

  const margemContribuicao = r2(lucroBruto - (cmoTotal || 0) - tVar);
  const antesDepreciacao = r2(margemContribuicao - tFix - tOut);
  const lucroLiquido = r2(antesDepreciacao - tDep);

  add("faturamento", "Faturamento do mês", fat, "receita");
  add("impostos", `(−) Impostos (${num(modelo.impostos_pct).toLocaleString("pt-BR")}%)`, impostos);
  add("cartao", "(−) Taxas de cartão", cartao, "custo", { detalhe: [
    { id: "credito", nome: `Crédito: ${num(c.parte_credito_pct).toLocaleString("pt-BR")}% das vendas × ${num(c.taxa_credito_pct).toLocaleString("pt-BR")}%`, valor: credito, pct: pct(credito, fat) },
    { id: "debito", nome: `Débito: ${num(c.parte_debito_pct).toLocaleString("pt-BR")}% das vendas × ${num(c.taxa_debito_pct).toLocaleString("pt-BR")}%`, valor: debito, pct: pct(debito, fat) },
  ] });
  add("receita_liquida", "(=) Receita líquida", receitaLiquida, "subtotal");
  add("cmv", "(−) CMV (mercadoria)", cmvValor, "custo", { natureza: cmvNatureza, motivo: cmv?.motivo || (cmvManual > 0 ? "Informado à mão (sem contagens apuradas)." : "") });
  add("lucro_bruto", "(=) Lucro bruto", cmvValor == null ? null : lucroBruto, "subtotal");
  add("cmo", "(−) CMO (equipe)", cmoTotal, "custo", { natureza: cmo ? "REAL" : "DADOS INSUFICIENTES", detalhe: porPessoa ? [
    { id: "salarios", nome: "Salários (RH)", valor: cmo.salarios, pct: pct(cmo.salarios, fat) },
    { id: "taxa", nome: "Taxa de serviço (RH, por funcionário)", valor: cmo.taxaServico, pct: pct(cmo.taxaServico, fat) },
    { id: "bonus", nome: "Bônus", valor: cmo.bonus, pct: pct(cmo.bonus, fat) },
    { id: "vales", nome: "Vale-alimentação e transporte (RH)", valor: cmo.vales, pct: pct(cmo.vales, fat) },
    { id: "encargos", nome: `Encargos (${num(modelo.encargos_pct).toLocaleString("pt-BR")}% do salário)`, valor: cmo.encargos, pct: pct(cmo.encargos, fat) },
    { id: "extras", nome: "Diárias de extras pagas no mês", valor: cmo.extras, pct: pct(cmo.extras, fat) },
  ].filter((d) => d.valor > 0) : cmo ? [
    { id: "folha", nome: "Folha dos contratados (salário + VA, do RH)", valor: r2(cmo.folha), pct: pct(cmo.folha, fat) },
    { id: "extras", nome: "Diárias de extras pagas no mês", valor: r2(cmo.extras), pct: pct(cmo.extras, fat) },
    ...(encargos > 0 ? [{ id: "encargos", nome: `Encargos (${num(modelo.encargos_pct).toLocaleString("pt-BR")}% da folha)`, valor: encargos, pct: pct(encargos, fat) }] : []),
  ] : [] });
  add("variaveis", "(−) Custos variáveis", tVar, "custo", { itens: variaveis });
  add("margem", "(=) Margem de contribuição", cmvValor == null || cmo == null ? null : margemContribuicao, "subtotal");
  add("fixos", "(−) Custos fixos", tFix, "custo", { itens: fixos });
  add("outros", "(−) Manutenção e outras despesas", tOut, "custo", { itens: outros });
  add("antes_depreciacao", "(=) Resultado antes da depreciação", cmvValor == null || cmo == null ? null : antesDepreciacao, "subtotal");
  add("depreciacao", "(−) Depreciação de equipamentos", tDep, "custo", { itens: deprec });
  const lucro = add("lucro_liquido", "(=) Lucro líquido", cmvValor == null || cmo == null ? null : lucroLiquido, "resultado");

  // Ponto de equilíbrio: venda que paga tudo e deixa lucro zero.
  //   custos que não mudam com a venda = CMO + fixos + manutenção/outras + depreciação
  //   % que sai de cada venda = impostos + cartão + CMV + variáveis (em % do faturamento informado)
  //   venda mínima do mês = custos que não mudam ÷ (1 − % que sai)
  let equilibrio;
  const fixosTotal = r2((cmoTotal || 0) + tFix + tOut + tDep);
  if (!(fat > 0)) equilibrio = { mes: null, dia: null, natureza: "DADOS INSUFICIENTES", motivo: "Informe o faturamento do mês: o CMV e os custos variáveis viram % sobre ele." };
  else if (cmvValor == null || !cmo) equilibrio = { mes: null, dia: null, natureza: "DADOS INSUFICIENTES", motivo: "Falta o CMV ou o CMO para saber quanto sobra de cada venda." };
  else {
    const pctSai = (impostos + cartao + cmvValor + tVar) / fat;
    const sobra = 1 - pctSai;
    if (!(sobra > 0)) equilibrio = { mes: null, dia: null, natureza: "DADOS INSUFICIENTES", motivo: "Impostos, cartão, CMV e variáveis já levam 100% ou mais de cada venda: não há venda que dê lucro com esses números." };
    else {
      const mesEq = r2(fixosTotal / sobra);
      equilibrio = {
        mes: mesEq, dia: porDia(mesEq), custosFixos: fixosTotal, custosFixosDia: porDia(fixosTotal),
        pctQueSai: r2(pctSai * 100), margemPct: r2(sobra * 100),
        folgaMes: r2(fat - mesEq), folgaDia: porDia(fat - mesEq), vendaMediaDia: porDia(fat),
        natureza: cmvNatureza === "ESTIMATIVA" ? "ESTIMATIVA" : "REAL",
        motivo: `Custos que não mudam com a venda (${r2(fixosTotal).toLocaleString("pt-BR")}) ÷ ${r2(sobra * 100).toLocaleString("pt-BR")}% que sobra de cada venda.${dias > 0 ? "" : " Informe os dias que abre para ver o valor por dia."}`,
      };
    }
  }

  const faltam = [];
  if (!(fat > 0)) faltam.push("faturamento do mês");
  if (cmvValor == null) faltam.push("CMV (contagens de estoque ou valor informado)");
  if (!cmo) faltam.push("CMO (equipe no RH)");
  return {
    linhas: L,
    faturamento: fat,
    lucroLiquido: lucro.valor,
    lucroPct: lucro.pct,
    prejuizo: lucro.valor != null && lucro.valor < 0,
    // Pizza: para onde vai cada real vendido (só com faturamento e tudo apurado).
    fatias: fat > 0 && !faltam.length ? [
      { id: "impostos", rotulo: "Impostos e cartão", valor: r2(impostos + cartao) },
      { id: "cmv", rotulo: "CMV", valor: cmvValor },
      { id: "cmo", rotulo: "Equipe (CMO)", valor: cmoTotal },
      { id: "variaveis", rotulo: "Variáveis", valor: tVar },
      { id: "fixos", rotulo: "Fixos e outros", valor: r2(tFix + tOut) },
      { id: "depreciacao", rotulo: "Depreciação", valor: tDep },
      { id: "lucro", rotulo: lucroLiquido >= 0 ? "Lucro" : "Prejuízo", valor: lucroLiquido },
    ].map((f) => ({ ...f, pct: pct(Math.abs(f.valor), fat) })) : [],
    faltam,
    dias,
    equilibrio,
    natureza: faltam.length ? "DADOS INSUFICIENTES" : cmvNatureza === "ESTIMATIVA" ? "ESTIMATIVA" : "REAL",
  };
}

/**
 * Contagens semanais do CMV na ponta do lápis (pedido do dono, 27/10/2026:
 * "essa semana adicionei X e retirei Y, então temos 32 mil de estoque, que dá
 * 28%"). Cada período entre duas contagens fechadas (apurarPeriodo):
 *   estoque no início + entrou (compras) − estoque no fim = saiu (CMV da semana)
 *   % = CMV ÷ faturamento da semana. Faturamento da semana: o diário do
 *   Héfisto quando existe (REAL); senão o do mês ÷ dias do mês × dias da
 *   semana (ESTIMATIVA). Sem faturamento: % = DADOS INSUFICIENTES.
 */
export function semanasDoCmv(apurados = [], { mes, faturamentoMes = 0 } = {}) {
  const [a, m] = String(mes).split("-").map(Number);
  const diasMes = a && m ? new Date(a, m, 0).getDate() : 30;
  const fatDia = num(faturamentoMes) > 0 ? num(faturamentoMes) / diasMes : 0;
  return (apurados || [])
    .filter((p) => p?.periodo)
    .map((p) => {
      const dias = p.periodo.dias || 0;
      const cmv = p.cmv?.valor ?? null;
      let fat = p.faturamento?.valor ?? null; let natFat = "REAL";
      if (fat == null && fatDia > 0 && dias > 0) { fat = r2(fatDia * dias); natFat = "ESTIMATIVA"; }
      return {
        id: p.periodo.id || `${p.periodo.de}`,
        de: p.periodo.de, ate: p.periodo.ate, dias,
        status: p.status,
        estoqueInicio: p.ei?.valor ?? null,
        entrou: p.compras?.valor ?? 0,
        estoqueFim: p.ef?.valor ?? null,
        saiu: cmv,
        faturamento: fat,
        naturezaFaturamento: fat == null ? "DADOS INSUFICIENTES" : natFat,
        cmvPct: cmv != null && fat > 0 ? r2((cmv / fat) * 100) : null,
        motivo: p.status === "apurado" ? "" : (p.motivos || []).join(" "),
      };
    })
    .sort((x, y) => String(y.de).localeCompare(String(x.de)));
}

/** Ticket médio: faturamento ÷ número de pedidos (ou clientes) informados. */
export function ticketMedio(faturamento, pedidos, dias = 0) {
  const f = num(faturamento); const n = Math.round(num(pedidos));
  if (!(f > 0) || !(n > 0)) return { valor: null, natureza: "DADOS INSUFICIENTES", motivo: "Informe o faturamento e quantos pedidos (ou clientes) teve no mês." };
  return { valor: r2(f / n), pedidosPorDia: dias > 0 ? r2(n / dias) : null, natureza: "INFORMADO", motivo: `${f.toLocaleString("pt-BR")} ÷ ${n.toLocaleString("pt-BR")} pedidos.` };
}
