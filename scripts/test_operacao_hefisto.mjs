import {
  parseNumero,
  unidadeNormalizada,
  grandezaDaUnidade,
  converterUnidade,
  fatorCorrecao,
  custoUnitarioDeCompra,
  custoIngrediente,
  custoSubreceita,
  custoPorUnidadeDeRendimento,
  custoDeProduzirFicha,
} from "../app/lib/ficha-calculos.mjs";

import {
  calcularPrecoNormalizado,
  precoNormalizadoDoInsumo,
  calcularCustoSolicitado,
} from "../app/lib/ingredientes-utils.mjs";

import {
  calcularConsumoProducao,
  totaisPorUnidade,
  ehEstoqueavel,
} from "../app/lib/producao-calculos.mjs";

console.log("=== INICIANDO BATERIA DE TESTES OPERACIONAIS HÉFISTO ===\n");

let falhas = 0;
let sucessos = 0;

function afirmar(condicao, mensagem) {
  if (condicao) {
    console.log(`  ✓ PASSOU: ${mensagem}`);
    sucessos++;
  } else {
    console.error(`  ❌ FALHOU: ${mensagem}`);
    falhas++;
  }
}

// ─── 1. TESTES DE CONVERSÃO DE UNIDADES ─────────────────────────────────────
console.log("--- 1. Conversão de Unidades e Massas/Volumes ---");
afirmar(converterUnidade(1, "kg", "g") === 1000, "1 kg = 1.000 g");
afirmar(converterUnidade(2500, "g", "kg") === 2.5, "2.500 g = 2,5 kg");
afirmar(converterUnidade(200, "g", "kg") === 0.2, "200 g = 0,2 kg");
afirmar(converterUnidade(1, "l", "ml") === 1000, "1 L = 1.000 ml");
afirmar(converterUnidade(750, "ml", "l") === 0.75, "750 ml = 0,75 L");
afirmar(converterUnidade(50, "ml", "l") === 0.05, "50 ml = 0,05 L");
afirmar(converterUnidade(1, "un", "un") === 1, "1 un = 1 un");
afirmar(converterUnidade(1, "kg", "ml") === null, "Incompatibilidade kg x ml sem densidade retorna null");

// ─── 2. TESTES DE CUSTOS E PREÇO NORMALIZADO ──────────────────────────────
console.log("\n--- 2. Cálculo de Custos e Proporção ---");
// Gin: garrafa 750ml por R$ 90,00 -> Custo/ml = 90 / 750 = R$ 0,12 / ml
const ginPrecoNorm = calcularPrecoNormalizado(750, "ml", 90);
afirmar(Math.abs(ginPrecoNorm - 120) < 0.001, "Gin 750ml R$90 -> Preço normalizado em L = R$ 120,00 / L (R$ 0,12 / ml)");

const gin50ml = calcularCustoSolicitado(
  { tamanho_embalagem: 750, unidade_medida: "ml", custo_compra: 90, preco_normalizado: 120 },
  50,
  "ml"
);
afirmar(Math.abs(gin50ml.valor - 6.00) < 0.01, "50 ml de Gin (garrafa R$90/750ml) custa exatamente R$ 6,00");

// Carne: R$ 80,00 / kg. Ficha usa 200g.
const carne200g = calcularCustoSolicitado(
  { tamanho_embalagem: 1, unidade_medida: "kg", custo_compra: 80, preco_normalizado: 80 },
  200,
  "g"
);
afirmar(Math.abs(carne200g.valor - 16.00) < 0.01, "200 g de Carne a R$80/kg custa exatamente R$ 16,00");

// ─── 3. TESTE DE PROPAGAÇÃO DE PREÇO EM CADEIA ─────────────────────────────
console.log("\n--- 3. Propagação de Alteração de Preço em Cadeia ---");
const insumoCarneInicial = { id: "ins-carne", nome: "Carne Bovina", unidade_medida: "kg", preco_normalizado: 10 };

const subfichaMolho = {
  id: "sub-molho",
  nome_receita: "Molho de Carne",
  rendimento_porcoes: 1, // 1 kg
  rendimento_unidade: "kg",
  eh_base: true,
  estoqueavel: true,
  fichas_ingredientes: [
    { insumo_id: "ins-carne", quantidade: 1, unidade: "kg", insumos: insumoCarneInicial }
  ]
};

const pratoFinal = {
  id: "prato-parmegiana",
  nome_receita: "Parmegiana",
  rendimento_porcoes: 1,
  rendimento_unidade: "porcao",
  fichas_ingredientes: [
    { subficha_id: "sub-molho", quantidade: 0.5, unidade: "kg" }
  ]
};

const todasFichasIniciais = [subfichaMolho, pratoFinal];

const custoMolhoInicial = custoDeProduzirFicha(subfichaMolho, todasFichasIniciais);
const custoPratoInicial = custoDeProduzirFicha(pratoFinal, todasFichasIniciais);

afirmar(Math.abs(custoMolhoInicial - 10) < 0.01, "Custo inicial do Molho (1kg carne @ R$10) = R$ 10,00");
afirmar(Math.abs(custoPratoInicial - 5) < 0.01, "Custo inicial do Prato (500g molho) = R$ 5,00");

// Mudar preço do insumo para R$ 20 / kg
const insumoCarneAtualizado = { ...insumoCarneInicial, preco_normalizado: 20 };
subfichaMolho.fichas_ingredientes[0].insumos = insumoCarneAtualizado;

const custoMolhoAtualizado = custoDeProduzirFicha(subfichaMolho, todasFichasIniciais);
const custoPratoAtualizado = custoDeProduzirFicha(pratoFinal, todasFichasIniciais);

afirmar(Math.abs(custoMolhoAtualizado - 20) < 0.01, "Novo custo do Molho (1kg carne @ R$20) = R$ 20,00 (sem editar a ficha)");
afirmar(Math.abs(custoPratoAtualizado - 10) < 0.01, "Novo custo do Prato = R$ 10,00 (propaga dinamicamente em cadeia)");

// ─── 4. TESTE DE PREVENÇÃO DE DUPLA BAIXA ──────────────────────────────────
console.log("\n--- 4. Prevenção de Dupla Baixa (Sub-receita estoqueável) ---");
const calculoPratoConsumo = calcularConsumoProducao(pratoFinal, 1, todasFichasIniciais);

afirmar(calculoPratoConsumo.itens.length === 1, "Prato consome apenas 1 item de estoque (o molho pronto)");
afirmar(calculoPratoConsumo.itens[0].subficha_id === "sub-molho", "Item de consumo retido na subficha de molho (impedindo baixa dos ingredientes crus)");
afirmar(calculoPratoConsumo.itens[0].quantidade === 0.5, "Quantidade de baixa do molho = 0,5 kg");

// ─── 5. TESTE DE UNIDADES NOS TOTAIS ────────────────────────────────────────
console.log("\n--- 5. Formatação dos Totais da Produção ---");
const mockProducoes = [
  { quantidade_produzida: 502, unidade_medida: "kg" },
  { quantidade_produzida: 10, unidade_medida: "L" },
];
const totais = totaisPorUnidade(mockProducoes);
afirmar(totais["kg"] === 502, "Totais agrupam 502 em 'kg'");
afirmar(totais["L"] === 10, "Totais agrupam 10 em 'L'");

console.log(`\n=== RESULTADO DOS TESTES AUTOMATIZADOS: ${sucessos} Passaram | ${falhas} Falharam ===`);
if (falhas > 0) process.exit(1);
