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
export function equilibrioDoCardapio({ params = {}, cmoMes = 0 } = {}) {
  const dias = Math.max(0, num(params.dias_operacao_mes));
  const fixoMes = CONTAS_FIXAS.reduce((s, [chave]) => s + num(params[chave]), 0) + Math.max(0, num(cmoMes));
  const fixoDia = dias > 0 ? fixoMes / dias : 0;

  // Tudo que é percentual sobre a venda: mercadoria, imposto, cartão, embalagem.
  const variavelPct = num(params.meta_cmv) + num(params.imposto_pct)
    + num(params.taxa_cartao_pct) + num(params.embalagem_pct);
  const margemPct = 100 - variavelPct;

  return {
    fixoMes, fixoDia, variavelPct, margemPct,
    // Margem zero ou negativa: cada venda já nasce sem sobra, então nenhum
    // faturamento empata. null em vez de Infinity, para a tela dizer o porquê.
    faturamentoDia: margemPct > 0 && dias > 0 ? fixoDia / (margemPct / 100) : null,
    faturamentoMes: margemPct > 0 && dias > 0 ? (fixoDia / (margemPct / 100)) * dias : null,
    rateavel: dias > 0,
  };
}
