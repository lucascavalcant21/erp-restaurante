// Cálculos da ficha técnica — funções puras, sem Supabase e sem React, para
// poderem ser testadas isoladamente (ficha-calculos.test.mjs).
//
// As fórmulas seguem a especificação do Livro de Receitas:
//   FC              = peso bruto / peso líquido           (1 kg → 800 g = 1,25)
//   custo do item   = custo unitário × quantidade × FC
//   custo subficha  = (custo total da subficha / rendimento) × quantidade × FC
//   perda %         = (bruto − final) / bruto × 100
//   CMV %           = custo por porção / preço de venda × 100
//   margem bruta    = preço de venda − custo por porção
//   markup          = preço de venda / custo por porção
//   preço sugerido  = custo por porção / (CMV desejado / 100)

// ─── Números e unidades ─────────────────────────────────────────────────────

// Aceita "1.234,56", "1234.56", 12 e devolve número (0 quando não dá pra ler).
export function parseNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined) return 0;
  const texto = String(valor).trim();
  if (!texto) return 0;
  // "1.234,56" → tira o ponto de milhar e troca a vírgula decimal por ponto.
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const n = Number(normalizado.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const FATORES_BASE = {
  kg: { base: "kg", fator: 1 },
  g: { base: "kg", fator: 0.001 },
  mg: { base: "kg", fator: 0.000001 },
  l: { base: "l", fator: 1 },
  ml: { base: "l", fator: 0.001 },
  un: { base: "un", fator: 1 },
  unidade: { base: "un", fator: 1 },
  pacote: { base: "un", fator: 1 },
  caixa: { base: "un", fator: 1 },
  cx: { base: "un", fator: 1 },
  garrafa: { base: "un", fator: 1 },
  lata: { base: "un", fator: 1 },
  bandeja: { base: "un", fator: 1 },
  saco: { base: "un", fator: 1 },
};

export function unidadeNormalizada(unidade) {
  return String(unidade || "").trim().toLowerCase().replace(/\.$/, "");
}

// Grandeza da unidade: 'kg' (peso), 'l' (volume) ou 'un' (contagem).
export function grandezaDaUnidade(unidade) {
  return FATORES_BASE[unidadeNormalizada(unidade)]?.base || null;
}

// Converte uma quantidade para a unidade-base do insumo. Devolve null quando as
// unidades são de grandezas diferentes (kg × L) — quem chama decide o que fazer,
// em vez de receber um número silenciosamente errado.
export function converterUnidade(quantidade, de, para) {
  const q = parseNumero(quantidade);
  const origem = FATORES_BASE[unidadeNormalizada(de)];
  const destino = FATORES_BASE[unidadeNormalizada(para)];
  if (!origem || !destino) return null;
  if (origem.base !== destino.base) return null;
  return (q * origem.fator) / destino.fator;
}

// ─── Fator de correção (peso bruto × peso líquido) ──────────────────────────

// FC = PB / PL. Ex.: 1 kg de bruto que rende 800 g limpos → 1,25.
// Devolve 1 quando não dá para calcular (evita zerar ou inflar custo à toa).
export function fatorCorrecao(pesoBruto, pesoLiquido) {
  const pb = parseNumero(pesoBruto);
  const pl = parseNumero(pesoLiquido);
  if (pb <= 0 || pl <= 0) return 1;
  return pb / pl;
}

// Caminho inverso: sabendo o FC, quanto sobra de um peso bruto.
export function pesoLiquidoPorFator(pesoBruto, fc) {
  const pb = parseNumero(pesoBruto);
  const f = parseNumero(fc);
  if (pb <= 0 || f <= 0) return 0;
  return pb / f;
}

// IMPORTANTE — semântica de `fichas_ingredientes.fator_correcao`.
//
// No banco esse campo é um PERCENTUAL ACRESCIDO, não um fator: 20 significa
// "+20% de quantidade bruta", e o custo é quantidade × 1,20. É assim que a tela
// de edição das fichas grava (updateFator) e calcula (custoTotalDaFicha), e é
// assim que os custos atuais das receitas foram formados.
//
// Esta função existe para que a ficha nova leia o campo EXATAMENTE como a tela
// antiga — a mesma receita não pode mostrar dois custos diferentes.
//
// Para o caso em que o usuário informa peso bruto e peso líquido, use
// `fatorCorrecao(pb, pl)`, que devolve o fator clássico PB/PL (1 kg → 800 g =
// 1,25) e é outra conta, de propósito.
export function fatorDeCorrecaoNormalizado(percentualAcrescido) {
  const v = parseNumero(percentualAcrescido);
  if (v <= 0) return 1;
  return 1 + v / 100;
}

// Converte o fator clássico PB/PL para o percentual acrescido que o banco usa,
// para quem preenche por pesos e quer gravar no mesmo campo. 1,25 → 25.
export function fatorParaPercentualAcrescido(fator) {
  const f = parseNumero(fator);
  if (f <= 1) return 0;
  return (f - 1) * 100;
}

// ─── Custo de compra → custo por unidade-base ───────────────────────────────

// R$ 40,00 pago por 1 kg → R$ 40,00/kg → R$ 0,04/g.
// `unidadeDestino` é opcional: sem ela devolve o custo na unidade de compra.
export function custoUnitarioDeCompra(precoCompra, quantidadeCompra, unidadeCompra, unidadeDestino) {
  const preco = parseNumero(precoCompra);
  const qtd = parseNumero(quantidadeCompra);
  if (preco <= 0 || qtd <= 0) return 0;
  const custoNaUnidadeDeCompra = preco / qtd;
  if (!unidadeDestino) return custoNaUnidadeDeCompra;
  // Quanto vale 1 unidade de destino na unidade de compra.
  const umDestinoEmCompra = converterUnidade(1, unidadeDestino, unidadeCompra);
  if (umDestinoEmCompra === null) return custoNaUnidadeDeCompra;
  return custoNaUnidadeDeCompra * umDestinoEmCompra;
}

// ─── Custo dos itens da ficha ───────────────────────────────────────────────

// Custo de um ingrediente na receita, já com o fator de correção aplicado.
// `fatorCorrecao` é o PERCENTUAL acrescido gravado no banco (20 = +20%), então
// o padrão é 0 — sem acréscimo.
export function custoIngrediente({ custoUnitario, quantidade, fatorCorrecao: fc = 0 }) {
  const custo = parseNumero(custoUnitario);
  const qtd = parseNumero(quantidade);
  const fator = fatorDeCorrecaoNormalizado(fc);
  if (custo <= 0 || qtd <= 0) return 0;
  return custo * qtd * fator;
}

// Custo de uma subreceita usada como ingrediente. O custo total da subficha é
// rateado pelo rendimento dela e multiplicado pela quantidade utilizada.
export function custoSubreceita({ custoTotalSubficha, rendimentoSubficha, quantidade, fatorCorrecao: fc = 0 }) {
  const total = parseNumero(custoTotalSubficha);
  const rend = Math.max(parseNumero(rendimentoSubficha), 1);
  const qtd = parseNumero(quantidade);
  const fator = fatorDeCorrecaoNormalizado(fc);
  if (total <= 0 || qtd <= 0) return 0;
  return (total / rend) * qtd * fator;
}

// ─── Custo efetivo do insumo (espelha a tela de edição de fichas) ──────────

// Empanados ganham peso (ganho_pct) e somam o custo do empanamento
// (custo_empanado_kg, por kg final). Só faz sentido em peso; nas demais
// unidades vale o custo base.
//
// Mesma conta de `custoUnitEfetivo` em dashboard/operacao/fichas/page.js — as
// duas telas precisam mostrar o mesmo custo para a mesma receita.
export function custoUnitarioEfetivoInsumo(insumo) {
  const base = parseNumero(insumo?.custo_unitario);
  if (!insumo?.empanado) return base;
  const ganho = 1 + parseNumero(insumo.ganho_pct) / 100;
  const u = unidadeNormalizada(insumo.unidade_medida);
  const empKg = parseNumero(insumo.custo_empanado_kg);
  const empNaUnidade = u === "g" ? empKg / 1000 : u === "kg" ? empKg : 0;
  return (ganho > 0 ? base / ganho : base) + empNaUnidade;
}

// Custo de produzir uma ficha inteira, resolvendo subfichas em cascata.
// `guard` impede laço infinito se alguém criar referência circular.
//
// Espelha `custoTotalDaFicha` da tela de edição, incluindo o
// `custo_embalagens_total` somado no fim.
export function custoDeProduzirFicha(ficha, todasFichas = [], guard = new Set()) {
  if (!ficha || guard.has(ficha.id)) return 0;
  guard.add(ficha.id);

  let total = 0;
  for (const fi of ficha.fichas_ingredientes || []) {
    const fc = fi.fator_correcao;
    if (fi.insumos) {
      total += custoIngrediente({
        custoUnitario: custoUnitarioEfetivoInsumo(fi.insumos),
        quantidade: fi.quantidade,
        fatorCorrecao: fc,
      });
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      if (!base) continue;
      total += custoSubreceita({
        custoTotalSubficha: custoDeProduzirFicha(base, todasFichas, guard),
        rendimentoSubficha: base.rendimento_porcoes,
        quantidade: fi.quantidade,
        fatorCorrecao: fc,
      });
    }
  }
  return total + parseNumero(ficha.custo_embalagens_total);
}

// Mapa `ficha id → ids das subfichas`, para a checagem de ciclo.
export function arestasDeSubfichas(fichas = []) {
  const mapa = new Map();
  for (const f of fichas) {
    mapa.set(
      f.id,
      (f.fichas_ingredientes || []).map(fi => fi.subficha_id).filter(Boolean)
    );
  }
  return mapa;
}

// ─── Subreceitas: detecção de ciclo ─────────────────────────────────────────

// `arestas` é um Map/objeto: id da ficha → array de ids de subfichas.
// Responde se incluir `subfichaId` dentro de `fichaId` fecharia um ciclo —
// inclusive o caso trivial de uma ficha apontar para ela mesma.
export function criariaCiclo(fichaId, subfichaId, arestas) {
  if (!fichaId || !subfichaId) return false;
  if (fichaId === subfichaId) return true;
  const vizinhos = (id) => {
    if (arestas instanceof Map) return arestas.get(id) || [];
    return (arestas && arestas[id]) || [];
  };
  // Se, partindo da subficha, chegarmos de volta na ficha, há ciclo.
  const visitados = new Set();
  const pilha = [subfichaId];
  while (pilha.length) {
    const atual = pilha.pop();
    if (atual === fichaId) return true;
    if (visitados.has(atual)) continue;
    visitados.add(atual);
    for (const proximo of vizinhos(atual)) pilha.push(proximo);
  }
  return false;
}

// ─── Custo total da receita ─────────────────────────────────────────────────

// Soma ingredientes + subreceitas + embalagem e aplica os custos indiretos.
// `indiretos` = { tipo: 'percentual' | 'fixo', valor: number }.
export function custoTotalReceita({
  custoIngredientes = 0,
  custoSubreceitas = 0,
  custoEmbalagem = 0,
  indiretos = null,
} = {}) {
  const ingredientes = Math.max(parseNumero(custoIngredientes), 0);
  const subreceitas = Math.max(parseNumero(custoSubreceitas), 0);
  const embalagem = Math.max(parseNumero(custoEmbalagem), 0);
  const direto = ingredientes + subreceitas + embalagem;

  let custoIndireto = 0;
  if (indiretos) {
    const valor = Math.max(parseNumero(indiretos.valor), 0);
    custoIndireto = indiretos.tipo === "fixo" ? valor : direto * (valor / 100);
  }

  return {
    custoIngredientes: ingredientes,
    custoSubreceitas: subreceitas,
    custoEmbalagem: embalagem,
    custoDireto: direto,
    custoIndireto,
    custoTotal: direto + custoIndireto,
  };
}

export function custoPorPorcao(custoTotal, porcoes) {
  const total = parseNumero(custoTotal);
  const n = parseNumero(porcoes);
  if (total <= 0 || n <= 0) return 0;
  return total / n;
}

// ─── Rendimento e perdas ────────────────────────────────────────────────────

export function perdaPeso(pesoBruto, pesoFinal) {
  const pb = parseNumero(pesoBruto);
  const pf = parseNumero(pesoFinal);
  if (pb <= 0 || pf <= 0) return 0;
  return Math.max(pb - pf, 0);
}

export function perdaPercentual(pesoBruto, pesoFinal) {
  const pb = parseNumero(pesoBruto);
  if (pb <= 0) return 0;
  return (perdaPeso(pb, pesoFinal) / pb) * 100;
}

export function pesoPorPorcao(pesoFinal, porcoes) {
  const pf = parseNumero(pesoFinal);
  const n = parseNumero(porcoes);
  if (pf <= 0 || n <= 0) return 0;
  return pf / n;
}

// Tempo total = preparo + cocção. Aceita número ou texto ("15 minutos").
export function tempoTotal(tempoPreparo, tempoCoccao) {
  return Math.max(parseNumero(tempoPreparo), 0) + Math.max(parseNumero(tempoCoccao), 0);
}

// ─── Precificação ───────────────────────────────────────────────────────────

export function cmvPercentual(custoPorcao, precoVenda) {
  const custo = parseNumero(custoPorcao);
  const preco = parseNumero(precoVenda);
  if (preco <= 0 || custo <= 0) return 0;
  return (custo / preco) * 100;
}

export function margemBruta(custoPorcao, precoVenda) {
  return parseNumero(precoVenda) - parseNumero(custoPorcao);
}

export function margemBrutaPercentual(custoPorcao, precoVenda) {
  const preco = parseNumero(precoVenda);
  if (preco <= 0) return 0;
  return (margemBruta(custoPorcao, preco) / preco) * 100;
}

export function markup(custoPorcao, precoVenda) {
  const custo = parseNumero(custoPorcao);
  if (custo <= 0) return 0;
  return parseNumero(precoVenda) / custo;
}

// Simulador de CMV: com que preço eu chego no CMV desejado.
export function precoSugerido(custoPorcao, cmvDesejadoPct) {
  const custo = parseNumero(custoPorcao);
  const cmv = parseNumero(cmvDesejadoPct);
  if (custo <= 0 || cmv <= 0 || cmv >= 100) return 0;
  return custo / (cmv / 100);
}

// ─── Código da ficha ────────────────────────────────────────────────────────

// FT-0001. `numero` é o próximo sequencial da unidade.
export function formatarCodigoFicha(numero, prefixo = "FT") {
  const n = Math.max(Math.trunc(parseNumero(numero)), 1);
  return `${prefixo}-${String(n).padStart(4, "0")}`;
}

// Próximo código livre a partir dos que já existem (ignora os fora do padrão).
export function proximoCodigoFicha(codigosExistentes = [], prefixo = "FT") {
  const padrao = new RegExp(`^${prefixo}-(\\d+)$`, "i");
  let maior = 0;
  for (const codigo of codigosExistentes) {
    const m = padrao.exec(String(codigo || "").trim());
    if (m) maior = Math.max(maior, Number(m[1]) || 0);
  }
  return formatarCodigoFicha(maior + 1, prefixo);
}

// ─── Versionamento ──────────────────────────────────────────────────────────

// "1.0" → "1.1"; "1.9" → "1.10". `maior` sobe a casa inteira: "1.4" → "2.0".
export function proximaVersao(versaoAtual, maior = false) {
  const texto = String(versaoAtual || "1.0").trim();
  const m = /^(\d+)\.(\d+)$/.exec(texto);
  if (!m) return maior ? "2.0" : "1.1";
  const principal = Number(m[1]);
  const secundaria = Number(m[2]);
  return maior ? `${principal + 1}.0` : `${principal}.${secundaria + 1}`;
}

// ─── Validações (seção 31 da especificação) ─────────────────────────────────

// Devolve a lista de problemas da ficha. Vazia = pode salvar.
export function validarFicha(ficha = {}, ingredientes = []) {
  const erros = [];
  if (!String(ficha.nome_receita || "").trim()) erros.push("A receita precisa de um nome.");

  const rendimento = parseNumero(ficha.rendimento_porcoes);
  if (rendimento <= 0) erros.push("O rendimento precisa ser maior que zero.");

  if (parseNumero(ficha.peso_bruto_g) < 0) erros.push("O peso bruto não pode ser negativo.");
  if (parseNumero(ficha.peso_final_g) < 0) erros.push("O peso final não pode ser negativo.");
  if (parseNumero(ficha.custo_indireto_valor) < 0) erros.push("O custo indireto não pode ser negativo.");

  const pb = parseNumero(ficha.peso_bruto_g);
  const pf = parseNumero(ficha.peso_final_g);
  if (pb > 0 && pf > 0 && pf > pb) {
    erros.push("O peso final não pode ser maior que o peso bruto.");
  }

  const cmvMeta = parseNumero(ficha.cmv_meta);
  if (ficha.cmv_meta !== undefined && ficha.cmv_meta !== null && ficha.cmv_meta !== "" &&
      (cmvMeta <= 0 || cmvMeta >= 100)) {
    erros.push("O CMV precisa ficar entre 0% e 100%.");
  }

  ingredientes.forEach((ing, i) => {
    const linha = ing?.nome || `Item ${i + 1}`;
    if (parseNumero(ing?.quantidade) <= 0) erros.push(`${linha}: a quantidade precisa ser maior que zero.`);
    if (!ing?.subficha_id && !String(ing?.unidade || "").trim()) erros.push(`${linha}: falta a unidade.`);
    if (parseNumero(ing?.custo_unitario) < 0) erros.push(`${linha}: o custo não pode ser negativo.`);
  });

  return erros;
}
