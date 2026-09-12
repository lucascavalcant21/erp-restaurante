// Testes da pizza do prato. Rode com: node app/lib/pizza-do-prato.test.mjs

import {
  fatiasDoPrato, rateioPorPrato, pratosNoMes, setorDonut, centroDoSetor,
  porcoesDaFicha, dadosDoPrato, COR_LUCRO,
} from "./pizza-do-prato.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
}
const r2 = (n) => Math.round(n * 100) / 100;

// ── Rateio ────────────────────────────────────────────────────────────────
const PARAMS = {
  dias_operacao_mes: 26, pratos_por_dia: 100,
  custo_aluguel_mes: 6000, custo_luz_mes: 1300, custo_gas_mes: 700,
  custo_agua_mes: 400, custo_limpeza_mes: 200, custo_outros_mes: 0,
  custo_cmo_mes: 16604,
};
conferir("pratos no mes", pratosNoMes(PARAMS), 2600);
conferir("custo fixo por prato", r2(rateioPorPrato(PARAMS).fixo), 3.31);  // 8600/2600
conferir("cmo por prato", r2(rateioPorPrato(PARAMS).cmo), 6.39);         // 16604/2600

// Sem dias ou sem pratos por dia nao da para ratear: zero, e marcado.
conferir("sem pratos por dia nao rateia", rateioPorPrato({ dias_operacao_mes: 26, pratos_por_dia: 0 }).rateavel, "false");
conferir("sem pratos por dia zera o fixo", rateioPorPrato({ custo_aluguel_mes: 9999, pratos_por_dia: 0 }).fixo, 0);

// ── Prato saudavel (o da tela: venda 45, ingrediente 11,24) ───────────────
const bom = fatiasDoPrato({
  preco: 45, custoIngredientes: 11.24, custoEmbalagem: 0,
  impostoPct: 4, taxaMaquininhaPct: 2.5, params: PARAMS,
});
conferir("cinco segmentos", bom.fatias.length, 5);
conferir("na ordem certa", bom.fatias.map(f => f.id).join(","), "cmv,cmo,fixo,variavel,lucro");
conferir("o lucro e o ultimo", bom.fatias[bom.fatias.length - 1].id, "lucro");
conferir("lucro fica verde", bom.fatias[bom.fatias.length - 1].cor, COR_LUCRO);

const seg = (id) => bom.fatias.find(f => f.id === id);
// Custo variavel = imposto + maquininha. 1,80 + 1,125 = 2,925
conferir("custo variavel soma imposto e maquininha", r2(seg("variavel").valor), 2.93);
conferir("imposto dentro do variavel", r2(seg("variavel").partes.find(x => x.rotulo === "Imposto").valor), 1.8);
conferir("maquininha dentro do variavel", r2(seg("variavel").partes.find(x => x.rotulo === "Maquininha").valor), 1.13);
// O peso DENTRO do segmento e outra leitura: imposto e 61,5% do custo variavel.
conferir("imposto pesa 62% do variavel", Math.round(seg("variavel").partes.find(x => x.rotulo === "Imposto").pctNoSegmento), 62);
conferir("partes do variavel fecham 100% do segmento",
  Math.round(seg("variavel").partes.reduce((t, x) => t + x.pctNoSegmento, 0)), 100);

// O custo fixo abre nas contas da casa.
conferir("custo fixo abre em contas", seg("fixo").partes.map(x => x.rotulo).join(","), "Aluguel,Luz,Gás,Água,Limpeza");
conferir("aluguel pesa 70% do custo fixo", Math.round(seg("fixo").partes[0].pctNoSegmento), 70);
conferir("partes do fixo fecham 100% do segmento",
  Math.round(seg("fixo").partes.reduce((t, x) => t + x.pctNoSegmento, 0)), 100);

// 11,24 + 6,3862 + 3,3077 + 2,925 = 23,8589  ->  lucro 21,14
conferir("custo total", r2(bom.custoTotal), 23.86);
conferir("lucro", r2(bom.lucro), 21.14);
conferir("sem prejuizo", bom.prejuizo, 0);
// O ponto da pizza: os segmentos TEM que fechar 100% do preco de venda.
conferir("segmentos somam 100%", Math.round(bom.fatias.reduce((s, f) => s + f.pct, 0)), 100);
conferir("segmentos somam o preco", r2(bom.fatias.reduce((s, f) => s + f.valor, 0)), 45);

// Embalagem entra no CMV, nao no variavel: senao seria contada duas vezes.
const comEmb = fatiasDoPrato({
  preco: 45, custoIngredientes: 10, custoEmbalagem: 1.5,
  impostoPct: 4, taxaMaquininhaPct: 2.5, params: PARAMS,
});
conferir("embalagem entra no CMV", r2(comEmb.fatias.find(f => f.id === "cmv").valor), 11.5);
conferir("CMV abre em ingrediente e embalagem",
  comEmb.fatias.find(f => f.id === "cmv").partes.map(x => x.rotulo).join(","), "Ingredientes,Embalagem");
conferir("com embalagem os segmentos ainda fecham o preco",
  r2(comEmb.fatias.reduce((s, f) => s + f.valor, 0)), 45);

// ── Prejuizo: custo passa do preco ────────────────────────────────────────
const ruim = fatiasDoPrato({
  preco: 10, custoIngredientes: 11.24, custoEmbalagem: 2,
  impostoPct: 4, taxaMaquininhaPct: 2.5, params: PARAMS,
});
conferir("prejuizo nao cria fatia de lucro", ruim.fatias.some(f => f.id === "lucro"), "false");
conferir("prejuizo marcado", r2(ruim.prejuizo) > 0, "true");
conferir("lucro nunca negativo", ruim.lucro, 0);
// Sem fatia de lucro o todo vira o custo, senao a pizza nao fecharia.
conferir("no prejuizo os segmentos ainda fecham 100%", Math.round(ruim.fatias.reduce((s, f) => s + f.pct, 0)), 100);

// ── Prato sem preco (base / pre-preparo) ──────────────────────────────────
const semPreco = fatiasDoPrato({ preco: 0, custoIngredientes: 5, params: PARAMS });
conferir("sem preco nao tem pizza", semPreco.fatias.length, 0);
conferir("sem preco nao inventa lucro", semPreco.lucro, 0);

// ── Segmento zerado nao vira pedaco invisivel ─────────────────────────────
const semNada = fatiasDoPrato({
  preco: 45, custoIngredientes: 11.24, impostoPct: 0, taxaMaquininhaPct: 0,
  params: { dias_operacao_mes: 26, pratos_por_dia: 100, custo_cmo_mes: 0 },
});
conferir("segmento de valor zero fica fora", semNada.fatias.some(f => f.valor === 0), "false");
conferir("so sobra cmv e lucro", semNada.fatias.map(f => f.id).join(","), "cmv,lucro");
conferir("parte de valor zero tambem fica fora",
  semNada.fatias.find(f => f.id === "cmv").partes.map(x => x.rotulo).join(","), "Ingredientes");

// ── Geometria da rosca ────────────────────────────────────────────────────
conferir("setor devolve um path", setorDonut(50, 50, 40, 24, 0, 90).startsWith("M "), "true");
conferir("setor de 360 nao some", setorDonut(50, 50, 40, 24, 0, 360).includes("A"), "true");
conferir("setor de 360 recua para fechar", setorDonut(50, 50, 40, 24, 0, 360) === setorDonut(50, 50, 40, 24, 0, 359.999), "true");
// O rotulo de % vai no meio da faixa: um quarto de volta a partir do topo
// cai na direita, na metade entre o raio interno e o externo.
conferir("centro do setor de 0 a 90 fica a direita", Math.round(centroDoSetor(50, 50, 40, 24, 0, 90).x), 73);
conferir("centro do setor de 0 a 90 fica na altura do meio", Math.round(centroDoSetor(50, 50, 40, 24, 0, 90).y), 27);

// ── Tirar os dados da ficha ───────────────────────────────────────────────
// Rendimento em porcoes: o numero e direto.
conferir("porcoes direto do rendimento",
  porcoesDaFicha({ rendimento_porcoes: 8, rendimento_unidade: "porcao" }), 8);
// Rendimento em kg: 2kg = 2000g, porcao de 250g -> 8 porcoes.
conferir("porcoes derivadas do peso",
  porcoesDaFicha({ rendimento_porcoes: 2, rendimento_unidade: "kg", peso_porcao_g: 250 }), 8);
conferir("sem peso da porcao nao inventa porcao",
  porcoesDaFicha({ rendimento_porcoes: 2, rendimento_unidade: "kg", peso_porcao_g: 0 }), 0);

// O preco do PRODUTO manda; a ficha so responde quando nao ha produto ligado.
const fichaX = { id: "f1", nome_receita: "Moqueca", rendimento_porcoes: 4, rendimento_unidade: "porcao", preco_venda: 30 };
conferir("preco do produto ganha do da ficha",
  dadosDoPrato(fichaX, { produtos: [{ ficha_id: "f1", preco_venda: 45 }] }).preco, 45);
conferir("sem produto vale o preco da ficha", dadosDoPrato(fichaX, { produtos: [] }).preco, 30);
conferir("produto casado pelo nome tambem vale",
  dadosDoPrato(fichaX, { produtos: [{ nome_produto: "moqueca", preco_venda: 50 }] }).preco, 50);

// Base (pre-preparo) nao se vende: imposto e maquininha nao incidem.
const base = dadosDoPrato({ id: "b1", eh_base: true, rendimento_porcoes: 1, rendimento_unidade: "porcao" }, {});
conferir("base nao paga imposto", base.impostoPct, 0);
conferir("base nao paga maquininha", base.taxaMaquininhaPct, 0);
// Prato normal usa os padroes da casa quando a ficha nao diz.
const normal = dadosDoPrato({ id: "n1", rendimento_porcoes: 1, rendimento_unidade: "porcao" }, {});
conferir("prato usa imposto padrao 4%", normal.impostoPct, 4);
conferir("prato usa maquininha padrao 2,5%", normal.taxaMaquininhaPct, 2.5);

// Embalagem sai do custo da porcao e vira parcela propria.
const comEmbalagem = dadosDoPrato(
  { id: "e1", rendimento_porcoes: 1, rendimento_unidade: "porcao", embalagens: [{ custo: 1.5, qtd: 2 }] }, {});
conferir("embalagem soma custo x quantidade", comEmbalagem.custoEmbalagem, 3);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
