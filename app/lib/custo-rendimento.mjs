// Custo de compra → custo efetivo do ingrediente. FONTE ÚNICA da conta de
// perda, rendimento e empanamento: cadastro de ingredientes, ficha técnica,
// simulações e produção leem daqui. Funções puras, sem Supabase e sem React
// (testes em custo-rendimento.test.mjs).
//
// A perda NÃO é um acréscimo percentual sobre o preço:
//
//   peso líquido   = peso bruto − perda             1.000 g − 150 g = 850 g
//   rendimento     = peso líquido / peso bruto      850 / 1.000     = 85%
//   custo efetivo  = custo de compra / rendimento   39,90 / 0,85    = R$ 46,94/kg
//
// "39,90 + 15%" dá R$ 45,89 e subestima toda ficha que usa o ingrediente.
//
// Configurar perda é configuração de custo: nada aqui movimenta estoque. A
// baixa física (bruto consumido) só acontece quando a produção é registrada.

import { precoNormalizadoDoInsumo, unidadeNormalizada } from "./ingredientes-utils.mjs";

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined || String(v).trim() === "") return NaN;
  const t = String(v).trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const positivo = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

// ─── Perda e rendimento ─────────────────────────────────────────────────────

// Lê a perda cadastrada no ingrediente. Peso bruto + perda em gramas mandam;
// sem eles, vale o percentual gravado (`perda_pct`). Sem nada, perda zero.
// `erro` preenchido = configuração impossível (perda ≥ bruto): o custo cai no
// de compra e a tela tem de avisar, em vez de dividir por zero.
export function rendimentoDoInsumo(insumo = {}) {
  const bruto = num(insumo?.peso_bruto_padrao ?? insumo?.peso_bruto_g);
  const perdaG = num(insumo?.perda_g);
  if (bruto > 0 && Number.isFinite(perdaG)) {
    if (perdaG < 0) return semPerda("A perda não pode ser negativa.");
    if (perdaG >= bruto) return semPerda("A perda precisa ser menor que o peso bruto.");
    const liquido = bruto - perdaG;
    return {
      configurada: true, pesoBrutoG: bruto, perdaG, pesoLiquidoG: liquido,
      perdaPct: (perdaG / bruto) * 100, rendimento: liquido / bruto, erro: null,
    };
  }
  const pct = num(insumo?.perda_pct);
  if (Number.isFinite(pct)) {
    if (pct < 0) return semPerda("A perda não pode ser negativa.");
    if (pct >= 100) return semPerda("A perda precisa ser menor que 100%.");
    return {
      configurada: true, pesoBrutoG: null, perdaG: null, pesoLiquidoG: null,
      perdaPct: pct, rendimento: 1 - pct / 100, erro: null,
    };
  }
  return semPerda(null);
}

function semPerda(erro) {
  return { configurada: false, pesoBrutoG: null, perdaG: null,
    pesoLiquidoG: null, perdaPct: 0, rendimento: 1, erro };
}

// Custo do que é aproveitável. Rendimento inválido devolve o próprio custo.
export function custoEfetivoPorRendimento(custoCompra, rendimento) {
  const c = positivo(num(custoCompra));
  const r = num(rendimento);
  if (!(r > 0 && r <= 1)) return c;
  return c / r;
}

// `fichas_ingredientes.fator_correcao` é PERCENTUAL ACRESCIDO sobre a
// quantidade líquida (bruta = líquida × (1 + fc/100)) — é assim que o banco,
// a produção e o custo da ficha o leem. A perda do cadastro é percentual do
// BRUTO. Converter: 15% de perda → 15 / 85 = +17,647% sobre o líquido.
// Assim 200 g limpos custam 200 g × R$ 46,94/kg e a produção baixa 235,3 g
// brutos do estoque — as duas contas saem do mesmo número.
export function fatorDaPerda(perdaPct) {
  const p = num(perdaPct);
  if (!(p > 0) || p >= 100) return 0;
  return (p / (100 - p)) * 100;
}

// ─── Empanamento / transformação ────────────────────────────────────────────

// Ordem obrigatória:
//   1 peso bruto · 2 perda · 3 peso líquido · 4 + empanamento
//   5 peso final · 6 custo total · 7 custo por kg final
//
// O custo da matéria-prima é o do BRUTO comprado (a perda já está paga). O
// ganho de peso não é de graça: o empanamento entra no peso E no custo.
//
// `itens` = composição [{ nome, quantidade, unidade, custoPorBase }] em que
// custoPorBase é R$/kg, R$/L ou R$/un e a quantidade usa g/kg/ml/L/un.
// Sem composição, aceita `custoEmpanamento` (R$ do lote) já calculado.
// `pesoAdicionadoG` é o quanto o produto ganhou de peso; quando omitido, é a
// soma do peso da composição (farinha que sobra na bandeja não gruda — se o
// ganho medido for outro, informe-o).
export function calcularEmpanamento({
  pesoBrutoG, perdaG = 0, custoCompraKg, itens = null, custoEmpanamento = null, pesoAdicionadoG = null,
} = {}) {
  const bruto = num(pesoBrutoG);
  const perda = Number.isFinite(num(perdaG)) ? num(perdaG) : 0;
  const preco = positivo(num(custoCompraKg));
  if (!(bruto > 0)) return { erro: "Informe o peso bruto da matéria-prima." };
  if (perda < 0 || perda >= bruto) return { erro: "A perda precisa ser menor que o peso bruto." };

  const pesoLiquidoG = bruto - perda;
  let custoDoEmpanamento = 0;
  let pesoDaComposicaoG = 0;
  const linhas = [];
  for (const it of Array.isArray(itens) ? itens : []) {
    const q = positivo(num(it?.quantidade));
    const un = String(it?.unidade || "").toLowerCase();
    const emBase = un === "g" || un === "ml" ? q / 1000 : q; // kg, L ou un
    const custo = emBase * positivo(num(it?.custoPorBase));
    if (un === "g" || un === "ml") pesoDaComposicaoG += q;
    else if (un === "kg" || un === "l") pesoDaComposicaoG += q * 1000;
    custoDoEmpanamento += custo;
    linhas.push({ nome: it?.nome || "Item", quantidade: q, unidade: un, custo });
  }
  if (!linhas.length) custoDoEmpanamento = positivo(num(custoEmpanamento));

  const adicionado = Number.isFinite(num(pesoAdicionadoG)) && num(pesoAdicionadoG) >= 0
    ? num(pesoAdicionadoG) : pesoDaComposicaoG;
  const pesoFinalG = pesoLiquidoG + adicionado;
  const custoMateriaPrima = (bruto / 1000) * preco;
  const custoTotal = custoMateriaPrima + custoDoEmpanamento;
  return {
    erro: null,
    pesoBrutoG: bruto, perdaG: perda, pesoLiquidoG,
    pesoAdicionadoG: adicionado, pesoFinalG,
    custoMateriaPrima, custoEmpanamento: custoDoEmpanamento, custoTotal,
    custoPorKgFinal: pesoFinalG > 0 ? custoTotal / (pesoFinalG / 1000) : 0,
    itens: linhas,
  };
}

// ─── O custo do ingrediente, tudo junto ─────────────────────────────────────

// Devolve os dois números que a tela mostra (compra e efetivo) e o que a
// ficha usa. `custoEfetivo` é por unidade-base (R$/kg, R$/L, R$/un) e é o
// custo do produto LIMPO — ou do produto final, se for empanado.
//
// Empanado com os campos atuais do cadastro: `ganho_pct` é o peso ganho sobre
// o peso líquido e `custo_empanado_kg` o custo do empanamento por kg FINAL.
// A perda entra antes (etapas 1–3) — antes ela era ignorada no empanado.
export function custoDoInsumo(insumo = {}) {
  const unidadeBase = unidadeNormalizada(insumo?.unidade_medida)
    || String(insumo?.unidade_medida || "un").toLowerCase();
  const custoCompra = positivo(precoNormalizadoDoInsumo(insumo))
    || positivo(num(insumo?.custo_unitario))
    || positivo(num(insumo?.custo_compra));
  const perda = rendimentoDoInsumo(insumo);
  const custoLimpo = custoEfetivoPorRendimento(custoCompra, perda.rendimento);

  let empanado = null;
  let custoEfetivo = custoLimpo;
  if (insumo?.empanado) {
    const ganho = Math.max(num(insumo?.ganho_pct) || 0, 0) / 100;
    const empKg = unidadeBase === "kg" ? positivo(num(insumo?.custo_empanado_kg)) : 0;
    // Lote de referência: o bruto cadastrado ou 1 kg.
    const bruto = perda.pesoBrutoG || 1000;
    const liquido = bruto * perda.rendimento;
    const adicionado = liquido * ganho;
    const finalKg = (liquido + adicionado) / 1000;
    empanado = calcularEmpanamento({
      pesoBrutoG: bruto, perdaG: bruto - liquido, custoCompraKg: custoCompra,
      custoEmpanamento: empKg * finalKg, pesoAdicionadoG: adicionado,
    });
    if (!empanado.erro) custoEfetivo = empanado.custoPorKgFinal;
  }

  return {
    unidadeBase,
    custoCompra,
    perdaPct: perda.perdaPct,
    rendimento: perda.rendimento,
    pesoBrutoG: perda.pesoBrutoG,
    perdaG: perda.perdaG,
    pesoLiquidoG: perda.pesoLiquidoG,
    perdaConfigurada: perda.configurada,
    erro: perda.erro,
    custoLimpo,
    custoEfetivo,
    aumentoPct: custoCompra > 0 ? (custoEfetivo / custoCompra - 1) * 100 : 0,
    empanado,
  };
}

// ─── Ficha técnica ──────────────────────────────────────────────────────────

// Fator de correção de uma linha da ficha (percentual acrescido).
//  • empanado: 0 — o custo por kg final já contém perda e empanamento, e a
//    quantidade da receita é de produto final;
//  • ingrediente com perda cadastrada (> 0): a perda do cadastro manda, ao
//    vivo — mudou o cadastro, mudou a ficha;
//  • sem perda no cadastro: o FC que foi digitado na própria ficha.
export function fatorCorrecaoDoItem(insumo, fatorGravado) {
  if (insumo?.empanado) return 0;
  const perda = rendimentoDoInsumo(insumo);
  if (perda.perdaPct > 0) return fatorDaPerda(perda.perdaPct);
  const f = num(fatorGravado);
  return Number.isFinite(f) && f > 0 ? f : 0;
}

// Custo unitário que a ficha multiplica pela quantidade líquida, junto com
// o fator acima: custo de compra (o fator faz o resto) ou, no empanado, o
// custo por kg final.
export function custoUnitarioParaFicha(insumo) {
  const c = custoDoInsumo(insumo);
  return insumo?.empanado ? c.custoEfetivo : c.custoCompra;
}
