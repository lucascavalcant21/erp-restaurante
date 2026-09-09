// Testes dos cálculos da ficha técnica. Rode com:
//   node app/lib/ficha-calculos.test.mjs

import {
  parseNumero, converterUnidade, grandezaDaUnidade,
  fatorCorrecao, pesoLiquidoPorFator, fatorDeCorrecaoNormalizado, fatorParaPercentualAcrescido,
  custoUnitarioDeCompra, custoIngrediente, custoSubreceita, criariaCiclo,
  custoTotalReceita, custoPorPorcao,
  perdaPeso, perdaPercentual, pesoPorPorcao, tempoTotal,
  cmvPercentual, margemBruta, margemBrutaPercentual, markup, precoSugerido,
  formatarCodigoFicha, proximoCodigoFicha, proximaVersao, validarFicha,
  custoUnitarioEfetivoInsumo, custoDeProduzirFicha, arestasDeSubfichas,
} from "./ficha-calculos.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)})`}`);
}
// Comparação de números com tolerância, para não brigar com ponto flutuante.
function perto(nome, obtido, esperado, casas = 4) {
  const ok = Math.abs(Number(obtido) - Number(esperado)) < Math.pow(10, -casas);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${obtido}, esperado ${esperado})`}`);
}

// ── Números no formato brasileiro ──────────────────────────────────────────
conferir("le 1.234,56 como numero", parseNumero("1.234,56"), 1234.56);
conferir("le 0,04", parseNumero("0,04"), 0.04);
conferir("le numero puro", parseNumero(12), 12);
conferir("texto vazio vira 0", parseNumero(""), 0);
conferir("nulo vira 0", parseNumero(null), 0);
conferir("R$ com simbolo", parseNumero("R$ 39,90"), 39.9);

// ── Unidades ───────────────────────────────────────────────────────────────
conferir("1 kg em g", converterUnidade(1, "kg", "g"), 1000);
conferir("150 g em kg", converterUnidade(150, "g", "kg"), 0.15);
conferir("1 L em ml", converterUnidade(1, "l", "ml"), 1000);
conferir("kg para litro nao converte", converterUnidade(1, "kg", "l"), null);
conferir("unidade desconhecida devolve null", converterUnidade(1, "punhado", "kg"), null);
conferir("grandeza de ml", grandezaDaUnidade("ml"), "l");
conferir("grandeza de caixa", grandezaDaUnidade("CX"), "un");

// ── Fator de correção (peso bruto × peso líquido) ──────────────────────────
// Exemplo da especificação: PB 1 kg, PL 800 g → FC 1,25.
perto("FC de 1000 g brutos para 800 g limpos", fatorCorrecao(1000, 800), 1.25);
perto("peso liquido a partir do FC", pesoLiquidoPorFator(1000, 1.25), 800);
conferir("FC sem dados nao inventa (devolve 1)", fatorCorrecao(0, 0), 1);

// ── A semântica gravada no banco: percentual acrescido, não fator ──────────
// A tela de edição grava 20 querendo dizer "+20%" e calcula quantidade × 1,20.
// A ficha nova PRECISA ler igual, senão a mesma receita mostra dois custos.
perto("20 no banco significa fator 1,20", fatorDeCorrecaoNormalizado(20), 1.2);
perto("0 no banco significa fator 1", fatorDeCorrecaoNormalizado(0), 1);
perto("30 no banco significa fator 1,30", fatorDeCorrecaoNormalizado(30), 1.3);
perto("fator 1,25 vira 25 para gravar", fatorParaPercentualAcrescido(1.25), 25);
perto("fator 1 vira 0", fatorParaPercentualAcrescido(1), 0);

// ── Custo de compra → custo por unidade ────────────────────────────────────
// Exemplo da especificação: R$ 40,00/kg → R$ 0,04/g.
perto("R$ 40 por 1 kg da R$ 0,04 por grama",
  custoUnitarioDeCompra(40, 1, "kg", "g"), 0.04);
perto("R$ 40 por 1 kg da R$ 40 por kg",
  custoUnitarioDeCompra(40, 1, "kg", "kg"), 40);
perto("R$ 12 por 6 unidades da R$ 2 cada",
  custoUnitarioDeCompra(12, 6, "un", "un"), 2);
perto("R$ 9 por 1,5 L da R$ 0,006 por ml",
  custoUnitarioDeCompra(9, 1.5, "l", "ml"), 0.006);

// ── Custo do ingrediente na receita ────────────────────────────────────────
// Exemplo da especificação: 150 g × R$ 0,04 = R$ 6,00.
perto("150 g a R$ 0,04 custa R$ 6,00",
  custoIngrediente({ custoUnitario: 0.04, quantidade: 150 }), 6);
perto("mesmo item com 20% de correcao custa R$ 7,20",
  custoIngrediente({ custoUnitario: 0.04, quantidade: 150, fatorCorrecao: 20 }), 7.2);
perto("quantidade zero nao custa nada",
  custoIngrediente({ custoUnitario: 0.04, quantidade: 0 }), 0);

// ── Subreceita ─────────────────────────────────────────────────────────────
// Maionese: custa R$ 20,00 e rende 1000 g. Usar 30 g custa R$ 0,60.
perto("30 g de uma base que custa 20 e rende 1000",
  custoSubreceita({ custoTotalSubficha: 20, rendimentoSubficha: 1000, quantidade: 30 }), 0.6);
perto("rendimento zero nao divide por zero",
  custoSubreceita({ custoTotalSubficha: 20, rendimentoSubficha: 0, quantidade: 1 }), 20);
perto("subreceita com correcao de 10%",
  custoSubreceita({ custoTotalSubficha: 20, rendimentoSubficha: 1000, quantidade: 30, fatorCorrecao: 10 }), 0.66);

// ── Custo efetivo do insumo e custo da ficha inteira ───────────────────────
perto("insumo comum usa o custo direto",
  custoUnitarioEfetivoInsumo({ custo_unitario: 0.04 }), 0.04);
// Empanado: 10% de ganho de peso e R$ 8,00/kg de empanamento, insumo em g.
perto("empanado dilui o custo pelo ganho e soma o empanamento",
  custoUnitarioEfetivoInsumo({
    custo_unitario: 0.044, empanado: true, ganho_pct: 10,
    custo_empanado_kg: 8, unidade_medida: "g",
  }), 0.048);

// Cheese Burger com uma subreceita (maionese) — confere o encadeamento.
const maionese = {
  id: "maionese", rendimento_porcoes: 1000,
  fichas_ingredientes: [{ insumos: { custo_unitario: 0.02 }, quantidade: 1000, fator_correcao: 0 }],
};
const burger = {
  id: "burger", rendimento_porcoes: 1,
  fichas_ingredientes: [
    { insumos: { custo_unitario: 0.04 }, quantidade: 150, fator_correcao: 0 }, // carne  6,00
    { subficha_id: "maionese", quantidade: 30, fator_correcao: 0 },            // maionese 0,60
  ],
};
perto("custo da subreceita isolada", custoDeProduzirFicha(maionese, [maionese]), 20);
perto("custo do prato com subreceita", custoDeProduzirFicha(burger, [burger, maionese]), 6.6);
perto("embalagem entra no custo da ficha",
  custoDeProduzirFicha({ ...burger, custo_embalagens_total: 0.2 }, [burger, maionese]), 6.8);
perto("referencia circular nao trava",
  custoDeProduzirFicha(
    { id: "a", rendimento_porcoes: 1, fichas_ingredientes: [{ subficha_id: "b", quantidade: 1 }] },
    [
      { id: "a", rendimento_porcoes: 1, fichas_ingredientes: [{ subficha_id: "b", quantidade: 1 }] },
      { id: "b", rendimento_porcoes: 1, fichas_ingredientes: [{ subficha_id: "a", quantidade: 1 }] },
    ]
  ), 0);
conferir("mapa de arestas das subfichas",
  JSON.stringify([...arestasDeSubfichas([burger, maionese])]),
  JSON.stringify([["burger", ["maionese"]], ["maionese", []]]));

// ── Ciclo entre subreceitas ────────────────────────────────────────────────
const arestas = { A: ["B"], B: ["C"], C: [] };
conferir("A dentro de A e ciclo", criariaCiclo("A", "A", arestas), true);
conferir("C dentro de A nao e ciclo", criariaCiclo("A", "C", arestas), false);
conferir("A dentro de C fecha o ciclo", criariaCiclo("C", "A", arestas), true);
conferir("A dentro de B fecha o ciclo", criariaCiclo("B", "A", arestas), true);
conferir("ficha solta nao da ciclo", criariaCiclo("A", "Z", arestas), false);
conferir("aceita Map tambem",
  criariaCiclo("C", "A", new Map([["A", ["B"]], ["B", ["C"]], ["C", []]])), true);

// ── Custo total com indiretos ──────────────────────────────────────────────
const semIndireto = custoTotalReceita({ custoIngredientes: 4.73, custoEmbalagem: 0.2 });
perto("custo direto do cheese burger", semIndireto.custoTotal, 4.93);

const comPercentual = custoTotalReceita({
  custoIngredientes: 10, custoSubreceitas: 5, custoEmbalagem: 0,
  indiretos: { tipo: "percentual", valor: 3 },
});
perto("3% de indireto sobre 15", comPercentual.custoIndireto, 0.45);
perto("total com 3% de indireto", comPercentual.custoTotal, 15.45);

const comFixo = custoTotalReceita({
  custoIngredientes: 10, indiretos: { tipo: "fixo", valor: 2.5 },
});
perto("indireto fixo entra inteiro", comFixo.custoTotal, 12.5);

perto("custo por porcao de 4 porcoes", custoPorPorcao(48, 4), 12);
perto("porcoes zero nao divide por zero", custoPorPorcao(48, 0), 0);

// ── Rendimento e perdas ────────────────────────────────────────────────────
perto("perda de peso 1000 para 800", perdaPeso(1000, 800), 200);
perto("perda percentual 1000 para 800", perdaPercentual(1000, 800), 20);
perto("sem peso nao ha perda", perdaPercentual(0, 0), 0);
perto("peso por porcao", pesoPorPorcao(1280, 4), 320);
perto("tempo total soma preparo e coccao", tempoTotal(15, 10), 25);
perto("tempo total le texto", tempoTotal("15 minutos", "10 min"), 25);

// ── Precificação ───────────────────────────────────────────────────────────
// Exemplo da ficha do Cheese Burger: custo 4,93 e preço 29,90 → CMV 16,5%.
perto("CMV do cheese burger", cmvPercentual(4.93, 29.9), 16.4883, 3);
perto("margem bruta em reais", margemBruta(4.93, 29.9), 24.97);
perto("margem bruta percentual", margemBrutaPercentual(4.93, 29.9), 83.5117, 3);
perto("markup", markup(10, 40), 4);
// Exemplo da especificação: custo 12,00 com CMV de 30% → preço 40,00.
perto("preco sugerido para CMV 30%", precoSugerido(12, 30), 40);
perto("preco sugerido para CMV 25%", precoSugerido(12, 25), 48);
perto("CMV invalido nao sugere preco", precoSugerido(12, 0), 0);
perto("CMV de 100% nao sugere preco", precoSugerido(12, 100), 0);
perto("preco zero nao gera CMV infinito", cmvPercentual(10, 0), 0);

// ── Código da ficha ────────────────────────────────────────────────────────
conferir("formata FT-0001", formatarCodigoFicha(1), "FT-0001");
conferir("formata FT-0042", formatarCodigoFicha(42), "FT-0042");
conferir("proximo de uma lista", proximoCodigoFicha(["FT-0001", "FT-0007"]), "FT-0008");
conferir("lista vazia comeca no 1", proximoCodigoFicha([]), "FT-0001");
conferir("ignora codigo fora do padrao", proximoCodigoFicha(["ABC", "FT-0003", null]), "FT-0004");

// ── Versões ────────────────────────────────────────────────────────────────
conferir("1.0 vira 1.1", proximaVersao("1.0"), "1.1");
conferir("1.9 vira 1.10", proximaVersao("1.9"), "1.10");
conferir("1.4 com salto maior vira 2.0", proximaVersao("1.4", true), "2.0");
conferir("versao invalida vira 1.1", proximaVersao("abc"), "1.1");

// ── Validações ─────────────────────────────────────────────────────────────
const fichaBoa = { nome_receita: "Cheese Burger", rendimento_porcoes: 1, peso_bruto_g: 340, peso_final_g: 320 };
conferir("ficha valida nao acusa erro", validarFicha(fichaBoa, [
  { nome: "Pão", quantidade: 1, unidade: "un", custo_unitario: 2 },
]).length, 0);

conferir("acusa receita sem nome", validarFicha({ rendimento_porcoes: 1 }).length > 0, true);
conferir("acusa rendimento zero",
  validarFicha({ nome_receita: "X", rendimento_porcoes: 0 }).some(e => /rendimento/i.test(e)), true);
conferir("acusa peso final maior que o bruto",
  validarFicha({ nome_receita: "X", rendimento_porcoes: 1, peso_bruto_g: 100, peso_final_g: 200 })
    .some(e => /peso final/i.test(e)), true);
conferir("acusa quantidade negativa",
  validarFicha({ nome_receita: "X", rendimento_porcoes: 1 }, [{ nome: "Sal", quantidade: -1, unidade: "g" }])
    .some(e => /quantidade/i.test(e)), true);
conferir("acusa ingrediente sem unidade",
  validarFicha({ nome_receita: "X", rendimento_porcoes: 1 }, [{ nome: "Sal", quantidade: 1 }])
    .some(e => /unidade/i.test(e)), true);
conferir("acusa CMV invalido",
  validarFicha({ nome_receita: "X", rendimento_porcoes: 1, cmv_meta: 150 })
    .some(e => /CMV/i.test(e)), true);
conferir("subreceita nao exige unidade",
  validarFicha({ nome_receita: "X", rendimento_porcoes: 1 }, [{ nome: "Maionese", quantidade: 30, subficha_id: "abc" }]).length, 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
