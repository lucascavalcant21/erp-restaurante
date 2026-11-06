// Metas do negócio (pedido do dono, 06/11/2026): quanto custa manter a casa viva por
// dia, quanto vender para empatar, a meta por período e a previsão do mês. O cálculo
// serve a Marmitaria, Restaurante e Eventos; cada um entrega os próprios números.

const r2 = (v) => Math.round(v * 100) / 100;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const SEMANAS_NO_ANO = 52;
export const MINIMO_DE_DIAS_PARA_PREVER = 3;

/** Referências de mercado: orientam, não são regra. A fonte acompanha cada faixa. */
export const REFERENCIAS = {
  cmv: { rotulo: "CMV", min: 30, max: 40, fonte: "Stone" },
  equipe: { rotulo: "Mão de obra", min: 20, max: 35, fonte: "7shifts" },
  aluguel: { rotulo: "Aluguel e ocupação", min: 6, max: 10, fonte: "HigherMe" },
  utilidades: { rotulo: "Energia, água e gás", min: 3, max: 5, fonte: "HigherMe" },
  lucro: { rotulo: "Lucro", min: 10, max: 20, fonte: "Saipos" },
};

/** Por marmita: o preço menos o que varia com a venda. É o que ajuda a pagar as contas. */
export function contribuicaoMedia(linhas = [], vendas = []) {
  const vendidas = new Map();
  for (const v of vendas) if (v?.ficha_id) vendidas.set(v.ficha_id, (vendidas.get(v.ficha_id) || 0) + num(v.quantidade));
  const itens = linhas.filter((l) => l.secao === "marmitas" && l.lucro != null && l.sim?.com?.valido).map((l) => {
    const c = l.sim.com;
    return { contrib: num(c.lucro) + num(c.cmo) + num(c.fixos), preco: num(c.preco), custo: num(c.custo), peso: vendidas.get(l.ficha?.id) || 0 };
  });
  if (!itens.length) return null;
  const pesoTotal = itens.reduce((t, i) => t + i.peso, 0);
  const media = (campo) => (pesoTotal > 0
    ? itens.reduce((t, i) => t + i[campo] * i.peso, 0) / pesoTotal
    : itens.reduce((t, i) => t + i[campo], 0) / itens.length);
  const ticket = media("preco");
  return { contribuicao: r2(media("contrib")), ticket: r2(ticket), cmvPct: ticket > 0 ? Math.round((media("custo") / ticket) * 1000) / 10 : null, ponderada: pesoTotal > 0 };
}

export function pontoDeEquilibrio({ cmoMes = null, fixosMes = null, diasMes = null, contribuicao = null, ticket = null } = {}) {
  const faltando = [];
  if (cmoMes === null && fixosMes === null) faltando.push("funcionários e custos fixos");
  if (!(num(diasMes) > 0)) faltando.push("dias de operação no mês");
  if (contribuicao === null) faltando.push("marmitas com preço e custo");
  if (faltando.length) return { ok: false, motivo: `Falta informar: ${faltando.join(", ")}.` };
  if (!(num(contribuicao) > 0)) return { ok: false, motivo: "Cada venda não cobre os próprios custos: revise preço e taxas." };
  const custoMes = num(cmoMes) + num(fixosMes);
  const unidadesMes = Math.ceil(custoMes / contribuicao);
  return {
    ok: true, custoMes: r2(custoMes), custoDia: r2(custoMes / diasMes),
    unidadesMes, unidadesDia: Math.ceil(unidadesMes / diasMes),
    faturamentoMes: r2(unidadesMes * num(ticket)), faturamentoDia: r2((unidadesMes * num(ticket)) / diasMes),
  };
}

/** O mesmo valor visto por dia, semana, mês e ano, a partir do mês de trabalho. */
export function porPeriodo(valorMes, diasMes) {
  if (valorMes === null || valorMes === undefined || !(num(diasMes) > 0)) return null;
  const v = num(valorMes);
  return { dia: r2(v / diasMes), semana: r2((v * 12) / SEMANAS_NO_ANO), mes: r2(v), ano: r2(v * 12) };
}

/** Faturamento por dia do mês corrente, com o acumulado. */
export function vendasDoMes(vendas = [], hojeIso) {
  const prefixo = String(hojeIso).slice(0, 7);
  const dias = new Map();
  for (const v of vendas) {
    if (!String(v?.data || "").startsWith(prefixo)) continue;
    const a = dias.get(v.data) || { data: v.data, valor: 0, quantidade: 0 };
    a.valor += num(v.valor_bruto) - num(v.descontos) - num(v.cancelamentos);
    a.quantidade += num(v.quantidade);
    dias.set(v.data, a);
  }
  let acumulado = 0;
  return [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)).map((d) => {
    acumulado += d.valor;
    return { ...d, valor: r2(d.valor), acumulado: r2(acumulado) };
  });
}

const diasNoMes = (iso) => {
  const [a, m] = String(iso).split("-").map(Number);
  return new Date(a, m, 0).getDate();
};

/**
 * Previsão do mês pelo ritmo dos dias vendidos (PROJEÇÃO). Com menos de três dias de
 * venda, não prevê: um dia forte não pode prometer o mês inteiro.
 */
export function previsaoDoMes({ dias = [], hojeIso, diasMes = null, metaMes = null, equilibrioMes = null } = {}) {
  if (!(num(diasMes) > 0)) return { ok: false, motivo: "Falta informar os dias de operação no mês." };
  if (dias.length < MINIMO_DE_DIAS_PARA_PREVER) {
    return { ok: false, motivo: `São ${dias.length} de ${MINIMO_DE_DIAS_PARA_PREVER} dias de venda neste mês, o mínimo para prever.` };
  }
  const vendido = dias.at(-1).acumulado;
  const ritmo = vendido / dias.length;
  const hojeDia = Number(String(hojeIso).slice(8, 10));
  const corridos = diasNoMes(hojeIso) - hojeDia;
  const restantes = Math.max(0, Math.min(corridos, diasMes - dias.length));
  const previsto = r2(vendido + ritmo * restantes);
  const meta = num(metaMes) > 0 ? num(metaMes) : null;
  const eq = num(equilibrioMes) > 0 ? num(equilibrioMes) : null;
  const falta = meta === null ? null : r2(Math.max(0, meta - previsto));
  const estado = meta !== null && previsto >= meta ? "bate_meta" : eq !== null && previsto < eq ? "abaixo_equilibrio" : meta !== null ? "abaixo_meta" : "sem_meta";
  return {
    ok: true, vendido, ritmo: r2(ritmo), diasVendidos: dias.length, restantes, previsto, falta, estado,
    precisaPorDia: meta !== null && restantes > 0 ? r2(Math.max(0, meta - vendido) / restantes) : null,
    pctDaMeta: meta !== null ? Math.round((previsto / meta) * 100) : null,
  };
}

/** Para chegar à meta: vender mais do item que mais deixa no bolso, dentro dos dias que restam. */
export function estrategia(previsao, pratos = []) {
  if (!previsao?.ok || !(previsao.falta > 0)) return null;
  const melhor = pratos.filter((p) => p.lucro > 0 && p.preco > 0).sort((a, b) => b.lucro - a.lucro)[0];
  if (!melhor) return null;
  const unidades = Math.ceil(previsao.falta / melhor.preco);
  return {
    nome: melhor.nome, unidades, porDia: previsao.restantes > 0 ? Math.ceil(unidades / previsao.restantes) : null,
    lucroExtra: r2(unidades * melhor.lucro), lucroPorUnidade: melhor.lucro,
  };
}

const faixa = (ref, pct) => (pct === null ? null : pct > ref.max ? "acima" : pct < ref.min ? "abaixo" : "dentro");
const ehAluguel = (n) => /aluguel|condom|iptu/i.test(n);
const ehUtilidade = (n) => /luz|energia|[áa]gua|g[áa]s/i.test(n);

/** Quanto cada conta pesa no faturamento, pessoa a pessoa e conta a conta. */
export function estruturaDoMes({ faturamento = null, cmvPct = null, cmoLinhas = [], fixosLinhas = [] } = {}) {
  const fat = num(faturamento);
  if (!(fat > 0)) return null;
  const pct = (v) => Math.round((v / fat) * 1000) / 10;
  const abrir = (linhas) => linhas.map((l) => ({ nome: l.nome, valor: r2(num(l.valor)), pct: pct(num(l.valor)) })).sort((a, b) => b.valor - a.valor);
  const soma = (linhas) => linhas.reduce((t, l) => t + num(l.valor), 0);
  const grupo = (id, ref, linhas) => ({ id, rotulo: ref.rotulo, referencia: ref, valor: r2(soma(linhas)), pct: pct(soma(linhas)), estado: faixa(ref, pct(soma(linhas))), linhas: abrir(linhas) });
  const aluguel = fixosLinhas.filter((l) => ehAluguel(l.nome));
  const utilidades = fixosLinhas.filter((l) => ehUtilidade(l.nome));
  const outras = fixosLinhas.filter((l) => !ehAluguel(l.nome) && !ehUtilidade(l.nome));
  const grupos = [];
  if (cmvPct !== null) grupos.push({ id: "cmv", rotulo: REFERENCIAS.cmv.rotulo, referencia: REFERENCIAS.cmv, valor: r2((fat * cmvPct) / 100), pct: Math.round(cmvPct * 10) / 10, estado: faixa(REFERENCIAS.cmv, cmvPct), linhas: [] });
  if (cmoLinhas.length) grupos.push(grupo("equipe", REFERENCIAS.equipe, cmoLinhas));
  if (aluguel.length) grupos.push(grupo("aluguel", REFERENCIAS.aluguel, aluguel));
  if (utilidades.length) grupos.push(grupo("utilidades", REFERENCIAS.utilidades, utilidades));
  if (outras.length) grupos.push({ id: "outras", rotulo: "Outras contas", referencia: null, valor: r2(soma(outras)), pct: pct(soma(outras)), estado: null, linhas: abrir(outras) });
  return { faturamento: r2(fat), grupos };
}

/** Lucro estimado das vendas: quantidade de cada item × lucro de hoje por pedido. */
export function lucroDasVendas(vendas = [], pratos = []) {
  const lucroPorItem = new Map(pratos.map((p) => [p.id, p.lucro]));
  let lucro = 0;
  let faturamento = 0;
  let semLucro = 0;
  let contados = 0;
  for (const v of vendas) {
    faturamento += num(v.valor_bruto) - num(v.descontos) - num(v.cancelamentos);
    if (lucroPorItem.has(v.ficha_id)) { lucro += num(v.quantidade) * lucroPorItem.get(v.ficha_id); contados += num(v.quantidade); }
    else semLucro += num(v.quantidade);
  }
  // Com item fora da conta, a porcentagem sairia menor do que é: melhor não mostrar.
  return { lucro: contados > 0 ? r2(lucro) : null, faturamento: r2(faturamento), pct: contados > 0 && !semLucro && faturamento > 0 ? Math.round((lucro / faturamento) * 1000) / 10 : null, semLucro };
}

/** O maior excesso sobre a referência, em reais: é por ali que o lucro está saindo. */
export function gargaloDaEstrutura(estrutura) {
  const acima = (estrutura?.grupos || []).filter((g) => g.estado === "acima").map((g) => ({
    id: g.id, rotulo: g.rotulo, pct: g.pct, limite: g.referencia.max, excesso: r2(((g.pct - g.referencia.max) / 100) * estrutura.faturamento),
  })).sort((a, b) => b.excesso - a.excesso);
  return acima[0] || null;
}

/** O que menos saiu no período. Parado é o que não vendeu nenhuma unidade. */
export function menosVendidos(itens = [], vendas = [], limite = 3) {
  const vendidas = new Map();
  for (const v of vendas) if (v?.ficha_id) vendidas.set(v.ficha_id, (vendidas.get(v.ficha_id) || 0) + num(v.quantidade));
  return itens.map((i) => ({ id: i.id, nome: i.nome, vendidas: vendidas.get(i.id) || 0 })).sort((a, b) => a.vendidas - b.vendidas || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, limite);
}

/** Movimento dos últimos 7 dias contra os 7 anteriores. Mostra a queda, não adivinha a causa. */
export function movimentoRecente(vendas = [], hojeIso) {
  const antes = (dias) => {
    const d = new Date(`${hojeIso}T12:00:00`);
    d.setDate(d.getDate() - dias);
    return d.toLocaleDateString("sv-SE");
  };
  const somar = (de, ate) => vendas.filter((v) => v.data > de && v.data <= ate).reduce((t, v) => t + num(v.quantidade), 0);
  const atual = somar(antes(7), hojeIso);
  const anterior = somar(antes(14), antes(7));
  if (!(anterior > 0)) return null;
  return { atual, anterior, variacaoPct: Math.round(((atual - anterior) / anterior) * 100) };
}
