// A pizza do prato: onde cada real da venda vai parar.
//
// A ideia é responder de olho uma pergunta só — "quanto desta venda sobra para
// mim?" — e mostrar quem come o resto. Por isso as fatias somam exatamente o
// PREÇO DE VENDA, e não o custo: uma pizza que soma custo não tem fatia de
// lucro, que é justamente a que interessa.
//
// As seis fatias são exclusivas entre si (nada é contado duas vezes):
//   CMV .......... ingredientes + embalagem (o que entra no prato)
//   CMO .......... folha do mês rateada por prato
//   Custo fixo ... aluguel, luz, gás, água, limpeza e outros, rateados
//   Imposto ...... % sobre a venda
//   Maquininha ... % sobre a venda
//   Lucro ........ o que sobra
//
// Imposto e maquininha SÃO os custos variáveis, junto com a embalagem. Não
// existe uma fatia "custo variável" separada porque ela repetiria esses três.

export const COR_LUCRO = "#10B981";

// Rampa dos custos, do mais escuro ao mais claro, na ordem em que aparecem.
// É sequencial de propósito: as fatias estão ordenadas por tamanho típico, e
// uma rampa se lê como rampa. O verde do lucro foi escolhido por separação
// medida contra todos estes degraus (ΔE mínimo 15,6).
export const CORES_CUSTO = ["#1E293B", "#334155", "#475569", "#64748B", "#94A3B8"];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Quantos pratos o mês inteiro produz. É o divisor do rateio: sem ele o custo
// fixo do mês inteiro cairia em cima de um prato só.
export function pratosNoMes(params = {}) {
  const dias = Math.max(0, num(params.dias_operacao_mes));
  const porDia = Math.max(0, num(params.pratos_por_dia));
  return dias * porDia;
}

// Custo fixo e mão de obra que cabem a UM prato.
export function rateioPorPrato(params = {}) {
  const pratos = pratosNoMes(params);
  if (pratos <= 0) return { fixo: 0, cmo: 0, rateavel: false };
  const fixoMes = num(params.custo_aluguel_mes) + num(params.custo_luz_mes)
    + num(params.custo_gas_mes) + num(params.custo_agua_mes)
    + num(params.custo_limpeza_mes) + num(params.custo_outros_mes);
  return { fixo: fixoMes / pratos, cmo: num(params.custo_cmo_mes) / pratos, rateavel: true };
}

/* Monta as fatias de um prato.
 *
 * Devolve { fatias, preco, custoTotal, lucro, prejuizo, rateavel }.
 * Cada fatia: { id, rotulo, valor, pct, cor }.
 *
 * Duas situações que a tela precisa tratar e por isso saem marcadas:
 *  - preco <= 0: prato sem preço de venda. Não há pizza (retorna fatias: []).
 *  - custo > preco: prejuízo. Não existe fatia negativa, então o lucro sai
 *    zerado, prejuizo vem com o valor faltante e as fatias passam a dividir o
 *    CUSTO — desenhar o contrário daria uma pizza mentindo que fecha.
 */
export function fatiasDoPrato({
  preco = 0, custoIngredientes = 0, custoEmbalagem = 0,
  impostoPct = 0, taxaMaquininhaPct = 0, params = {},
} = {}) {
  const precoVenda = Math.max(0, num(preco));
  const { fixo, cmo, rateavel } = rateioPorPrato(params);

  const cmv = Math.max(0, num(custoIngredientes)) + Math.max(0, num(custoEmbalagem));
  const imposto = precoVenda * (Math.max(0, num(impostoPct)) / 100);
  const maquininha = precoVenda * (Math.max(0, num(taxaMaquininhaPct)) / 100);

  // Rótulo curto e detalhe separado: na legenda dentro do cartão o nome longo
  // era cortado no meio ("CMV (ingrediente + embalag..."), que é pior do que
  // não explicar. O detalhe aparece ao passar o mouse na fatia.
  const custos = [
    { id: "cmv",        rotulo: "CMV",        detalhe: "ingrediente + embalagem",      valor: cmv },
    { id: "cmo",        rotulo: "CMO",        detalhe: "mão de obra rateada",          valor: cmo },
    { id: "fixo",       rotulo: "Custo fixo", detalhe: "aluguel, luz, gás, água, etc", valor: fixo },
    { id: "imposto",    rotulo: "Imposto",    detalhe: "sobre a venda",                valor: imposto },
    { id: "maquininha", rotulo: "Maquininha", detalhe: "sobre a venda",                valor: maquininha },
  ].map((c, i) => ({ ...c, cor: CORES_CUSTO[i] }));

  const custoTotal = custos.reduce((s, c) => s + c.valor, 0);

  if (precoVenda <= 0) {
    return { fatias: [], preco: 0, custoTotal, lucro: 0, prejuizo: 0, rateavel };
  }

  const lucro = precoVenda - custoTotal;
  const prejuizo = lucro < 0 ? -lucro : 0;
  // Com prejuízo não há fatia de lucro: o todo passa a ser o custo.
  const todo = prejuizo > 0 ? custoTotal : precoVenda;

  const fatias = custos.filter((c) => c.valor > 0).map((c) => ({ ...c, pct: (c.valor / todo) * 100 }));
  if (prejuizo === 0 && lucro > 0) {
    fatias.push({ id: "lucro", rotulo: "Lucro", detalhe: "o que sobra para você", valor: lucro, pct: (lucro / todo) * 100, cor: COR_LUCRO });
  }

  return { fatias, preco: precoVenda, custoTotal, lucro: Math.max(0, lucro), prejuizo, rateavel };
}

// Caminho do setor de uma rosca (donut). Ângulos em graus, 0 no topo.
export function setorDonut(cx, cy, raioExterno, raioInterno, inicioGrau, fimGrau) {
  const rad = (g) => ((g - 90) * Math.PI) / 180;
  // Um setor de 360° não pode ser desenhado com arco: início e fim caem no
  // mesmo ponto e o path some. Recua um fio de grau para fechar visualmente.
  const fim = fimGrau - inicioGrau >= 360 ? inicioGrau + 359.999 : fimGrau;
  const [i, f] = [rad(inicioGrau), rad(fim)];
  const grande = fim - inicioGrau > 180 ? 1 : 0;
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`;
  return `M ${p(raioExterno, i)} A ${raioExterno} ${raioExterno} 0 ${grande} 1 ${p(raioExterno, f)}`
       + ` L ${p(raioInterno, f)} A ${raioInterno} ${raioInterno} 0 ${grande} 0 ${p(raioInterno, i)} Z`;
}
