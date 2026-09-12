// Custo por dia, aberto item a item — e a simulação de quanto precisa vender.
//
// A pergunta que isto responde não é "quanto custa o mês", é "quanto sai do
// meu bolso HOJE, antes de eu vender o primeiro prato". Um número mensal de
// R$ 25 mil não diz nada na hora de decidir abrir a casa numa terça fraca;
// "R$ 960 por dia, dos quais R$ 640 é gente" diz.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const p2 = (n) => String(n).padStart(2, "0");

// Data no fuso de quem está olhando a tela, no formato AAAA-MM-DD. Mesma
// convenção do `isoData` de compras.mjs: dia do calendário local, não UTC.
const diaLocal = (iso) => {
  // O texto vazio precisa ser barrado ANTES do `new Date`: `new Date(null)` e
  // `new Date("")` não dão data inválida, dão 1º de janeiro de 1970 — uma
  // venda sem data viraria um dia de movimento em 1970 e entraria na média.
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

const ehExtra = (c) => String(c?.tipo_contrato || "") === "Freelancer";
const ativo = (c) => (c?.status || "ativo") !== "inativo" && c?.ativo !== false;

export const CONTAS_FIXAS = [
  ["custo_aluguel_mes", "Aluguel"],
  ["custo_luz_mes", "Luz"],
  ["custo_gas_mes", "Gás"],
  ["custo_agua_mes", "Água"],
  ["custo_limpeza_mes", "Limpeza"],
  ["custo_outros_mes", "Outros"],
];

/* Cada conta da casa dividida pelos dias em que a casa ABRE.
 *
 * Divide pelos dias de operação, não por 30: o aluguel de um mês é pago com o
 * que se vende nos dias em que se vende. Dividir por 30 num restaurante que
 * fecha segunda faz o custo do dia parecer menor do que é.
 */
export function contasPorDia(params = {}, dias) {
  const d = Math.max(0, num(dias || params.dias_operacao_mes));
  const itens = CONTAS_FIXAS
    .map(([chave, rotulo]) => ({ chave, rotulo, mes: num(params[chave]) }))
    .filter((x) => x.mes > 0)
    .map((x) => ({ ...x, dia: d > 0 ? x.mes / d : 0 }));
  return {
    itens,
    totalMes: itens.reduce((s, x) => s + x.mes, 0),
    totalDia: itens.reduce((s, x) => s + x.dia, 0),
    rateavel: d > 0,
  };
}

/* Quanto cada pessoa custa por dia de operação.
 *
 * Contratado: o salário é do mês inteiro, então divide pelos dias de operação.
 * Extra: a diária JÁ É o custo de um dia — dividir de novo diria que um
 * freelancer de R$ 130 custa R$ 5 por dia, o que é falso; ele custa R$ 130 nos
 * dias em que vem.
 */
export function equipePorDia(colaboradores = [], dias) {
  const d = Math.max(0, num(dias));
  const pessoas = (colaboradores || []).filter((c) => c && ativo(c)).map((c) => {
    const extra = ehExtra(c);
    const mes = extra ? 0 : num(c.salario) + num(c.vale_alimentacao) + num(c.taxa_servico_mes);
    return {
      id: c.id,
      nome: c.nome || "—",
      cargo: c.cargo || "",
      extra,
      mes,
      dia: extra ? num(c.salario) : (d > 0 ? mes / d : 0),
    };
  });
  const fixos = pessoas.filter((p) => !p.extra).sort((a, b) => b.dia - a.dia);
  const extras = pessoas.filter((p) => p.extra).sort((a, b) => b.dia - a.dia);
  return {
    fixos, extras,
    totalFixosDia: fixos.reduce((s, p) => s + p.dia, 0),
    totalFixosMes: fixos.reduce((s, p) => s + p.mes, 0),
    rateavel: d > 0,
  };
}

/* Simulação: vendendo N deste prato por mês, quanto sobra — e quanto preciso
 * vender para não sair no prejuízo.
 *
 * Usa margem de contribuição, que é o único jeito honesto de fazer esta conta:
 *   contribuição por unidade = preço − CMV − custo variável
 * O que sobra de CADA venda para pagar o que não muda (fixo e folha). Dividir
 * o custo fixo pelas unidades e somar ao custo do prato dá um "custo unitário"
 * que muda conforme o volume — e aí a conta anda em círculo.
 *
 * `unidadesParaEmpatar` é o ponto de equilíbrio EM PRATOS: quantos deste item
 * pagam o mês. Vem null quando a contribuição é zero ou negativa, porque nesse
 * caso não existe quantidade que empate — vender mais só aumenta o buraco.
 */
export function simularMes({
  preco = 0, custoCmvUnit = 0, impostoPct = 0, taxaMaquininhaPct = 0,
  custoFixoMes = 0, cmoMes = 0, unidadesMes = 0,
} = {}) {
  const p = Math.max(0, num(preco));
  const variavelUnit = p * (Math.max(0, num(impostoPct)) + Math.max(0, num(taxaMaquininhaPct))) / 100;
  const contribuicaoUnit = p - Math.max(0, num(custoCmvUnit)) - variavelUnit;
  const fixoTotal = Math.max(0, num(custoFixoMes)) + Math.max(0, num(cmoMes));

  const n = Math.max(0, num(unidadesMes));
  const receita = n * p;
  const contribuicaoTotal = n * contribuicaoUnit;
  const sobra = contribuicaoTotal - fixoTotal;

  return {
    precoUnit: p,
    variavelUnit,
    contribuicaoUnit,
    // Quanto de cada real vendido sobra para pagar o fixo. É a "margem" que o
    // dono pensa quando diz "vendo com margem de X".
    contribuicaoPct: p > 0 ? (contribuicaoUnit / p) * 100 : 0,
    fixoTotal,
    receita,
    custoVariavelTotal: n * (Math.max(0, num(custoCmvUnit)) + variavelUnit),
    contribuicaoTotal,
    sobra,
    unidadesParaEmpatar: contribuicaoUnit > 0 ? Math.ceil(fixoTotal / contribuicaoUnit) : null,
    receitaParaEmpatar: contribuicaoUnit > 0 ? Math.ceil(fixoTotal / contribuicaoUnit) * p : null,
  };
}

// O caminho inverso: quero que sobre X no fim do mês, quantos pratos preciso?
export function unidadesParaSobrar({ alvo = 0, contribuicaoUnit = 0, fixoTotal = 0 }) {
  const c = num(contribuicaoUnit);
  if (c <= 0) return null;
  return Math.ceil((num(fixoTotal) + Math.max(0, num(alvo))) / c);
}

/* Ponto de equilíbrio do CARDÁPIO INTEIRO — quanto faturar por dia para pagar
 * tudo. Veio da tela Ponto de Equilíbrio, que foi absorvida por esta.
 *
 * Diferente do simularMes, que responde por um prato concreto. Aqui a conta é
 * do salão todo, usando a META de CMV: não interessa qual prato saiu, e sim
 * que em média X% de cada real vendido volta como custo de mercadoria.
 *
 * A maquininha e o imposto entram porque saem de CADA venda. Fora da conta, o
 * equilíbrio sai otimista e a casa "empata" num número que não paga as contas.
 */
export function equilibrioDoCardapio({ params = {}, cmoMes = 0, precoMedio = 0 } = {}) {
  const dias = Math.max(0, num(params.dias_operacao_mes));
  const fixoMes = CONTAS_FIXAS.reduce((s, [chave]) => s + num(params[chave]), 0) + Math.max(0, num(cmoMes));
  const fixoDia = dias > 0 ? fixoMes / dias : 0;

  // A embalagem é um valor em REAIS por prato — uma caixa custa o que custa,
  // não uma fatia do preço. Para entrar numa conta que roda sobre faturamento
  // ela vira percentual pelo preço médio do cardápio: R$ 1,50 de caixa num
  // prato de R$ 45 pesa 3,3% da venda. Sem preço médio (nenhum prato com
  // preço) ela fica de fora, em vez de ser chutada.
  const pm = Math.max(0, num(precoMedio));
  const embalagemPct = pm > 0 ? (Math.max(0, num(params.embalagem_valor)) / pm) * 100 : 0;

  const variavelPct = num(params.meta_cmv) + num(params.imposto_pct)
    + num(params.taxa_cartao_pct) + embalagemPct;
  const margemPct = 100 - variavelPct;

  return {
    fixoMes, fixoDia, variavelPct, margemPct, embalagemPct,
    // Margem zero ou negativa: cada venda já nasce sem sobra, então nenhum
    // faturamento empata. null em vez de Infinity, para a tela dizer o porquê.
    faturamentoDia: margemPct > 0 && dias > 0 ? fixoDia / (margemPct / 100) : null,
    faturamentoMes: margemPct > 0 && dias > 0 ? (fixoDia / (margemPct / 100)) * dias : null,
    rateavel: dias > 0,
  };
}

export const LIMITE_PRATOS = 20;
export const LIMITE_BEBIDAS = 10;

/* Simulação do cardápio montado: vários itens, cada um com sua quantidade no
 * mês, e o resultado do conjunto.
 *
 * A armadilha desta conta é o custo fixo e a folha. Eles são do MÊS, não do
 * prato: somá-los item a item multiplicaria o aluguel pelo número de linhas do
 * cardápio. Aqui cada item contribui com o que sobra dele (preço − CMV −
 * variável), e o fixo + folha é descontado UMA vez do total.
 *
 * `faltaParaEmpatar` é quanto de contribuição ainda falta. Em reais e não em
 * pratos porque, com vários itens, não existe "quantos pratos": depende de
 * quais. O que dá para dizer é quanto de margem falta juntar.
 */
export function simularCardapio({ itens = [], custoFixoMes = 0, cmoMes = 0 } = {}) {
  const fixoTotal = Math.max(0, num(custoFixoMes)) + Math.max(0, num(cmoMes));

  const calculados = (itens || []).map((it) => {
    const preco = Math.max(0, num(it.preco));
    const qtd = Math.max(0, num(it.quantidade));
    const cmvUnit = Math.max(0, num(it.custoCmvUnit));
    const variavelUnit = preco * (Math.max(0, num(it.impostoPct)) + Math.max(0, num(it.taxaMaquininhaPct))) / 100;
    const contribuicaoUnit = preco - cmvUnit - variavelUnit;
    return {
      ...it,
      preco, quantidade: qtd, contribuicaoUnit,
      receita: preco * qtd,
      cmvTotal: cmvUnit * qtd,
      variavelTotal: variavelUnit * qtd,
      contribuicaoTotal: contribuicaoUnit * qtd,
    };
  });

  const soma = (campo) => calculados.reduce((t, x) => t + x[campo], 0);
  const receita = soma("receita");
  const contribuicaoTotal = soma("contribuicaoTotal");

  return {
    itens: calculados.map((x) => ({
      ...x,
      // Peso de cada item no faturamento: mostra quem sustenta o cardápio.
      pctDaReceita: receita > 0 ? (x.receita / receita) * 100 : 0,
    })),
    quantidadeTotal: calculados.reduce((t, x) => t + x.quantidade, 0),
    receita,
    cmvTotal: soma("cmvTotal"),
    variavelTotal: soma("variavelTotal"),
    contribuicaoTotal,
    fixoTotal,
    sobra: contribuicaoTotal - fixoTotal,
    // Quanto de cada real vendido sobra, no conjunto. É a margem que o
    // cardápio inteiro entrega, não a de um prato.
    margemMediaPct: receita > 0 ? (contribuicaoTotal / receita) * 100 : 0,
    faltaParaEmpatar: Math.max(0, fixoTotal - contribuicaoTotal),
  };
}

/* Quantos itens a casa vende por dia, MEDIDO nas vendas — em vez de chutado.
 *
 * Este número divide o custo fixo e a folha por prato, então errá-lo estraga
 * a tela inteira: trocar 100 por 1 multiplica por cem o custo de cada prato.
 * Pedir para o dono adivinhar é pedir o número mais perigoso da conta a quem
 * não tem como saber — e o sistema já registra cada venda.
 *
 * Divide pelos DIAS EM QUE HOUVE VENDA, não pelos dias do período. Um mês com
 * dez dias de movimento e vinte fechados não vende "a metade por dia": vende
 * o que vende nos dias em que abre, e é essa média que rateia o custo dos
 * dias abertos.
 */
export function mediaItensPorDia(vendas = []) {
  const porDia = new Map();
  for (const v of vendas || []) {
    // O dia é o do RELÓGIO DA CASA, não o do UTC gravado no banco. Cortar a
    // string do `created_at` jogaria a virada para as 21h de Brasília — no
    // meio do jantar —, partindo uma noite de serviço em dois "dias" e
    // derrubando a média justamente no número que esta conta existe para
    // acertar.
    const dia = diaLocal(v?.created_at);
    if (!dia) continue;
    const itens = (v.itens || []).reduce((t, i) => t + Math.max(0, num(i.quantidade)), 0);
    porDia.set(dia, (porDia.get(dia) || 0) + itens);
  }
  const dias = [...porDia.values()].filter((n) => n > 0);
  const total = dias.reduce((t, n) => t + n, 0);
  return {
    totalItens: total,
    diasComVenda: dias.length,
    media: dias.length > 0 ? total / dias.length : 0,
    // Sem venda nenhuma no período não há o que medir, e a tela precisa dizer
    // isso em vez de sugerir zero prato por dia.
    temDados: dias.length > 0,
  };
}
