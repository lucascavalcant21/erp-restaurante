// A pizza do prato: onde cada real da venda vai parar.
//
// A ideia é responder de olho uma pergunta só — "quanto desta venda sobra para
// mim?" — e mostrar quem come o resto. Por isso as fatias somam exatamente o
// PREÇO DE VENDA, e não o custo: uma pizza que soma custo não tem fatia de
// lucro, que é justamente a que interessa.
//
// Os cinco segmentos são exclusivos entre si (nada é contado duas vezes), e
// cada um mostra por dentro do que é feito:
//   CMV ............. ingredientes + embalagem
//   CMO ............. folha do mês rateada por prato
//   Custo fixo ...... aluguel, luz, gás, água, limpeza e outros, rateados
//   Custo variável .. imposto + maquininha (o que varia com a venda)
//   Lucro ........... o que sobra
//
// Imposto e maquininha ficam DENTRO do custo variável em vez de virarem fatias
// soltas: eles são o custo variável, e repetir os dois por fora faria a pizza
// passar de 100%.

export const COR_LUCRO = "#10B981";

// Rampa dos custos, do mais escuro ao mais claro, na ordem em que aparecem.
// É sequencial de propósito: as fatias estão ordenadas por tamanho típico, e
// uma rampa se lê como rampa. O verde do lucro foi escolhido por separação
// medida contra todos estes degraus (ΔE mínimo 15,6).
export const CORES_CUSTO = ["#1E293B", "#334155", "#475569", "#64748B"];

import { custoDeProduzirFicha } from "./ficha-calculos.mjs";

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

// Custo fixo e mão de obra que cabem a UM prato. `itensFixo` guarda a conta
// aberta para a tela poder mostrar o que forma o custo fixo por dentro.
export function rateioPorPrato(params = {}) {
  const pratos = pratosNoMes(params);
  const linhas = [
    { rotulo: "Aluguel", mes: num(params.custo_aluguel_mes) },
    { rotulo: "Luz", mes: num(params.custo_luz_mes) },
    { rotulo: "Gás", mes: num(params.custo_gas_mes) },
    { rotulo: "Água", mes: num(params.custo_agua_mes) },
    { rotulo: "Limpeza", mes: num(params.custo_limpeza_mes) },
    { rotulo: "Outros", mes: num(params.custo_outros_mes) },
  ];
  if (pratos <= 0) return { fixo: 0, cmo: 0, itensFixo: [], rateavel: false };
  const itensFixo = linhas.filter((l) => l.mes > 0).map((l) => ({ rotulo: l.rotulo, valor: l.mes / pratos }));
  return {
    fixo: itensFixo.reduce((t, l) => t + l.valor, 0),
    cmo: num(params.custo_cmo_mes) / pratos,
    itensFixo,
    rateavel: true,
  };
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
  const { fixo, cmo, itensFixo, rateavel } = rateioPorPrato(params);

  const ingredientes = Math.max(0, num(custoIngredientes));
  const embalagem = Math.max(0, num(custoEmbalagem));
  const imposto = precoVenda * (Math.max(0, num(impostoPct)) / 100);
  const maquininha = precoVenda * (Math.max(0, num(taxaMaquininhaPct)) / 100);

  const segmentos = [
    { id: "cmv",      rotulo: "CMV",            valor: ingredientes + embalagem,
      partes: [{ rotulo: "Ingredientes", valor: ingredientes }, { rotulo: "Embalagem", valor: embalagem }] },
    { id: "cmo",      rotulo: "CMO",            valor: cmo,
      partes: [{ rotulo: "Mão de obra rateada", valor: cmo }] },
    { id: "fixo",     rotulo: "Custo fixo",     valor: fixo, partes: itensFixo },
    { id: "variavel", rotulo: "Custo variável", valor: imposto + maquininha,
      partes: [{ rotulo: "Imposto", valor: imposto }, { rotulo: "Maquininha", valor: maquininha }] },
  ].map((c, i) => ({ ...c, cor: CORES_CUSTO[i] }));

  const custoTotal = segmentos.reduce((t, c) => t + c.valor, 0);

  if (precoVenda <= 0) {
    return { fatias: [], preco: 0, custoTotal, lucro: 0, prejuizo: 0, rateavel };
  }

  const lucro = precoVenda - custoTotal;
  const prejuizo = lucro < 0 ? -lucro : 0;
  // Com prejuízo não há fatia de lucro: o todo passa a ser o custo.
  const todo = prejuizo > 0 ? custoTotal : precoVenda;

  // `pct` é a fatia sobre o todo; `pctNoSegmento` é quanto a parte pesa DENTRO
  // do seu segmento. São leituras diferentes: "imposto é 4% da venda" e
  // "imposto é 61% do meu custo variável".
  const comPartes = (seg) => ({
    ...seg,
    pct: (seg.valor / todo) * 100,
    partes: (seg.partes || []).filter((x) => x.valor > 0).map((x) => ({
      ...x,
      pct: (x.valor / todo) * 100,
      pctNoSegmento: seg.valor > 0 ? (x.valor / seg.valor) * 100 : 0,
    })),
  });

  const fatias = segmentos.filter((c) => c.valor > 0).map(comPartes);
  if (prejuizo === 0 && lucro > 0) {
    fatias.push({
      id: "lucro", rotulo: "Lucro", valor: lucro, pct: (lucro / todo) * 100, cor: COR_LUCRO,
      partes: [{ rotulo: "O que sobra para você", valor: lucro, pct: (lucro / todo) * 100, pctNoSegmento: 100 }],
    });
  }

  return { fatias, preco: precoVenda, custoTotal, lucro: Math.max(0, lucro), prejuizo, rateavel };
}

// Ponto no meio da faixa da rosca, onde cabe o rótulo de porcentagem.
export function centroDoSetor(cx, cy, raioExterno, raioInterno, inicioGrau, fimGrau) {
  const meio = ((inicioGrau + fimGrau) / 2 - 90) * (Math.PI / 180);
  const r = (raioExterno + raioInterno) / 2;
  return { x: cx + r * Math.cos(meio), y: cy + r * Math.sin(meio) };
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

/* Tira de uma ficha tudo que a pizza precisa.
 *
 * Existe para as duas telas (o cartão das Fichas e o módulo do lucro) fazerem
 * a MESMA conta. Duas derivações separadas divergem na primeira mudança, e aí
 * o sistema mostra dois lucros diferentes para o mesmo prato — o pior tipo de
 * erro, porque nenhum dos dois parece errado sozinho.
 */
export function pesoTotalDaFichaG(rendimento, unidade, pesoPorcaoG) {
  const un = String(unidade || "porcao").toLowerCase();
  if (un === "kg" || un === "l") return rendimento * 1000;
  if (un === "g" || un === "ml") return rendimento;
  return pesoPorcaoG > 0 ? rendimento * pesoPorcaoG : 0; // porções ou unidades
}

// Quantas porções a ficha rende: direto, quando o rendimento já é em porções
// ou unidades; pelo peso, quando é em kg/l/g/ml.
export function porcoesDaFicha(ficha = {}) {
  const rendimento = num(ficha.rendimento_porcoes) || 0;
  const pesoPorcao = num(ficha.peso_porcao_g) || 0;
  const un = String(ficha.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rendimento;
  const total = pesoTotalDaFichaG(rendimento, un, pesoPorcao);
  return pesoPorcao > 0 && total > 0 ? total / pesoPorcao : 0;
}

export function dadosDoPrato(ficha = {}, { fichas = [], produtos = [], params = {} } = {}) {
  const custoTotal = custoDeProduzirFicha(ficha, fichas);
  const porcoes = porcoesDaFicha(ficha);

  // Sem saber em quantas porções a receita rende, NÃO existe custo por porção.
  // Cobrar o lote inteiro de uma porção só (o que o código fazia) inventa um
  // custo absurdo: um drink de R$ 40 aparecia com R$ 125 de custo e "prejuízo"
  // de R$ 85. Melhor dizer que não dá para calcular do que dar um número que
  // parece real e manda tomar a decisão errada.
  const semRendimento = !(porcoes > 0);
  const custoPorcao = semRendimento ? 0 : custoTotal / porcoes;

  // O preço mandado é o do produto de venda; a ficha só responde quando não há
  // produto ligado a ela.
  const prod = produtos.find((x) => x.ficha_id === ficha.id
    || String(x.nome_produto || "").toLowerCase() === String(ficha.nome_receita || "").toLowerCase());
  const preco = (prod && num(prod.preco_venda) > 0) ? num(prod.preco_venda) : num(ficha.preco_venda);

  const custoEmbalagem = (ficha.embalagens || []).reduce(
    (acc, e) => acc + (num(e.custo) || num(e.preco_unitario)) * (num(e.qtd) || 1), 0);

  const custoIngredientes = Math.max(0, custoPorcao - custoEmbalagem);

  return {
    preco,
    custoIngredientes,
    custoEmbalagem,
    // Duas situações em que a pizza sai bonita e mentindo, e a tela precisa
    // avisar em vez de exibir um lucro alto com ar de verdade:
    semRendimento,
    // Revenda (uma cerveja, um refrigerante) costuma não ter ingrediente na
    // ficha. Sem custo de produto, tudo vira "lucro" e o prato aparece com
    // 90% e poucos — número que não é dele.
    semCusto: !semRendimento && custoIngredientes + custoEmbalagem <= 0,
    departamento: String(ficha.departamento || ficha.tipo_base || "").toLowerCase(),
    // Base (pré-preparo) não se vende, então imposto e maquininha não incidem.
    impostoPct: ficha.eh_base ? 0 : num(ficha.imposto_pct ?? prod?.aliquota_imposto ?? 4),
    taxaMaquininhaPct: ficha.eh_base ? 0 : num(ficha.taxa_maquininha ?? prod?.taxa_cartao ?? 2.5),
    params,
  };
}
