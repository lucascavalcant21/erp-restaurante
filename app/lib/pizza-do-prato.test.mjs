// Testes da pizza do prato. Rode com: node app/lib/pizza-do-prato.test.mjs

import { fatiasDoPrato, rateioPorPrato, pratosNoMes, setorDonut, COR_LUCRO } from "./pizza-do-prato.mjs";

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
conferir("seis fatias", bom.fatias.length, 6);
conferir("a ultima fatia e o lucro", bom.fatias[bom.fatias.length - 1].id, "lucro");
conferir("lucro fica verde", bom.fatias[bom.fatias.length - 1].cor, COR_LUCRO);
conferir("imposto de 4% sobre 45", r2(bom.fatias.find(f => f.id === "imposto").valor), 1.8);
conferir("maquininha de 2,5% sobre 45", r2(bom.fatias.find(f => f.id === "maquininha").valor), 1.13);
// Somando os valores EXATOS (nao os ja arredondados): 11,24 + 6,3862 +
// 3,3077 + 1,80 + 1,125 = 23,8589. Arredondar cada parcela antes de somar
// daria 23,87 e um centavo de diferenca no lucro.
conferir("custo total", r2(bom.custoTotal), 23.86);
conferir("lucro", r2(bom.lucro), 21.14);
conferir("sem prejuizo", bom.prejuizo, 0);
// O ponto da pizza: as fatias TEM que fechar 100% do preco de venda.
conferir("fatias somam 100%", Math.round(bom.fatias.reduce((s, f) => s + f.pct, 0)), 100);
conferir("fatias somam o preco", r2(bom.fatias.reduce((s, f) => s + f.valor, 0)), 45);

// ── Prejuizo: custo passa do preco ────────────────────────────────────────
const ruim = fatiasDoPrato({
  preco: 10, custoIngredientes: 11.24, custoEmbalagem: 2,
  impostoPct: 4, taxaMaquininhaPct: 2.5, params: PARAMS,
});
conferir("prejuizo nao cria fatia de lucro", ruim.fatias.some(f => f.id === "lucro"), "false");
conferir("prejuizo marcado", r2(ruim.prejuizo) > 0, "true");
conferir("lucro nunca negativo", ruim.lucro, 0);
// Sem fatia de lucro o todo vira o custo, senao a pizza nao fecharia.
conferir("no prejuizo as fatias ainda fecham 100%", Math.round(ruim.fatias.reduce((s, f) => s + f.pct, 0)), 100);

// ── Prato sem preco (base / pre-preparo) ──────────────────────────────────
const semPreco = fatiasDoPrato({ preco: 0, custoIngredientes: 5, params: PARAMS });
conferir("sem preco nao tem pizza", semPreco.fatias.length, 0);
conferir("sem preco nao inventa lucro", semPreco.lucro, 0);

// ── Fatia zerada nao vira pedaco invisivel ────────────────────────────────
const semImposto = fatiasDoPrato({
  preco: 45, custoIngredientes: 11.24, impostoPct: 0, taxaMaquininhaPct: 0,
  params: { dias_operacao_mes: 26, pratos_por_dia: 100, custo_cmo_mes: 0 },
});
conferir("fatia de valor zero fica fora", semImposto.fatias.some(f => f.valor === 0), "false");
conferir("so sobra cmv e lucro", semImposto.fatias.map(f => f.id).join(","), "cmv,lucro");

// ── Geometria da rosca ────────────────────────────────────────────────────
conferir("setor devolve um path", setorDonut(50, 50, 40, 24, 0, 90).startsWith("M "), "true");
conferir("setor de 360 nao some", setorDonut(50, 50, 40, 24, 0, 360).includes("A"), "true");
conferir("setor de 360 recua para fechar", setorDonut(50, 50, 40, 24, 0, 360) === setorDonut(50, 50, 40, 24, 0, 359.999), "true");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
