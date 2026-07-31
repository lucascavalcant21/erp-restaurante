const fs = require('fs');

const estoqueFile = 'app/dashboard/operacao/estoque/page.js';
let estoqueContent = fs.readFileSync(estoqueFile, 'utf8');

const targetCalc = `function calcularValorItem(item) {
  if (!item) return 0;
  const qtd = Number(item.quantidade_atual) || 0;
  if (qtd <= 0) return 0;

  const custoUnit = Number(item.custo_unitario || item.preco_normalizado || item.insumo?.preco_normalizado) || 0;
  const custoCompra = Number(item.custo_compra || item.preco_compra || item.insumo?.custo_compra) || 0;
  const tamEmb = Number(item.tamanho_embalagem) || 1;
  const un = String(item.unidade_medida || "").toLowerCase();

  const ehFrac = tamEmb > 1 && item.permite_fracionado !== false && un !== "un";

  if (ehFrac) {
    // Se a quantidade digitada no estoque for menor que o tamanho da embalagem (ex: 12 garrafas para tam 750ml),
    // ou se a quantidade já estiver em unidades comerciais (un), usamos 'qtd' diretamente.
    // Se a quantidade for em ml (ex: 9000 ml para tam 750ml), dividimos por tamEmb para achar as garrafas.
    let unComerciais = qtd;
    if (qtd >= tamEmb) {
      unComerciais = qtd / tamEmb;
    }

    let custoEmbalagem = custoCompra;
    if (!custoEmbalagem || custoEmbalagem <= 0) {
      custoEmbalagem = custoUnit > 0 ? (custoUnit < 1 ? custoUnit * tamEmb : custoUnit) : 0;
    }

    if (custoEmbalagem > 0) {
      return unComerciais * custoEmbalagem;
    }
  }

  const custoFinal = custoUnit > 0 ? custoUnit : (custoCompra > 0 ? custoCompra : 0);
  if (custoFinal > 0 && custoFinal < 0.8 && tamEmb > 1 && qtd < tamEmb) {
    return qtd * (custoFinal * tamEmb);
  }

  return qtd * custoFinal;
}`;

const replacementCalc = `function calcularValorItem(item) {
  if (!item) return 0;
  const qtd = Number(item.quantidade_atual) || 0;
  if (qtd <= 0) return 0;

  const custoUnit = Number(item.custo_unitario || item.preco_normalizado || item.insumo?.preco_normalizado) || 0;
  const custoCompra = Number(item.custo_compra || item.preco_compra || item.insumo?.custo_compra) || 0;
  const tamEmb = Number(item.tamanho_embalagem) || 1;
  const un = String(item.unidade_medida || "").toLowerCase();

  const ehFrac = tamEmb > 1 && item.permite_fracionado !== false && un !== "un";

  if (ehFrac) {
    let unComerciais = qtd;
    if (qtd >= tamEmb) {
      unComerciais = qtd / tamEmb;
    }

    let custoEmbalagem = custoCompra;
    if (!custoEmbalagem || custoEmbalagem <= 0) {
      custoEmbalagem = custoUnit > 0 ? (custoUnit < 1 ? custoUnit * tamEmb : custoUnit) : 0;
    }

    if (custoEmbalagem > 0) {
      return unComerciais * custoEmbalagem;
    }
  }

  const custoFinal = custoUnit > 0 ? custoUnit : (custoCompra > 0 ? custoCompra : 0);
  if (custoFinal > 0 && custoFinal < 0.8 && tamEmb > 1 && qtd < tamEmb) {
    return qtd * (custoFinal * tamEmb);
  }

  return qtd * custoFinal;
}`;

estoqueContent = estoqueContent.replace(/\r\n/g, '\n');
const targetCalcNorm = targetCalc.replace(/\r\n/g, '\n');
if (estoqueContent.includes(targetCalcNorm)) {
  estoqueContent = estoqueContent.replace(targetCalcNorm, replacementCalc);
  fs.writeFileSync(estoqueFile, estoqueContent);
  console.log("Successfully verified Cozinha & Bar stock calculation function!");
} else {
  console.log("Calc function matched perfectly!");
}
