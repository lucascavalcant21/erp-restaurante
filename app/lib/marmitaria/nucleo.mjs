// Núcleo de cálculo da Marmitaria & Delivery — funções puras, sem Supabase e
// sem React (testes em nucleo.test.mjs).
//
// Regra da casa: nunca inventar número. Sem dado, o valor sai `null` com o
// motivo; cada resultado diz a natureza (real, estimativa, simulação).
//
// Custo de ingrediente e de pré-preparo NÃO é recalculado aqui por fórmula
// própria: cada linha passa por custoDeProduzirFicha (ficha-calculos.mjs), a
// mesma conta das fichas técnicas do restaurante. Assim a marmita e o prato
// que usam o mesmo arroz cozido dão o mesmo custo de arroz.

import {
  parseNumero, custoDeProduzirFicha, custoUnitarioEfetivoInsumo, converterParaBaseDoInsumo,
  custoIngrediente, fatorDeCorrecaoNormalizado,
} from "../ficha-calculos.mjs";
import { fatorCorrecaoDoItem } from "../custo-rendimento.mjs";
import { unidadeNormalizada } from "../ingredientes-utils.mjs";
import { comprasDaJanela, fronteiraDaContagem, somarDiasIso } from "../cmv-real.mjs";
import { ehFracionavel, ehUnidadeContavel } from "../inventario-saldo.mjs";

export const r2 = (n) => (n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);
const r4 = (n) => Math.round(Number(n) * 10000) / 10000;
const pos = (v) => { const n = parseNumero(v); return n > 0 ? n : 0; };
const pct = (v) => pos(v) / 100;
const soma = (xs, f = (x) => x) => xs.reduce((t, x) => t + (Number(f(x)) || 0), 0);

// ─── Unidades ────────────────────────────────────────────────────────────────

// Fator entre a unidade do CADASTRO e a do SALDO no estoque — o mesmo
// _estoque_fator_saldo do banco: o saldo fica na unidade do cadastro (kg, L,
// un…), exceto a garrafa fracionada, que guarda em conteúdo (ml): aí o fator é
// o tamanho da embalagem. (Antes era 1000 para kg/L: produção e transferência
// da marmitaria moveriam 1000× a quantidade — B-018.)
export function fatorSaldo(insumo) {
  if (!insumo || typeof insumo !== "object") return 1;
  return ehFracionavel(insumo) && ehUnidadeContavel(insumo.unidade_medida) ? Math.max(Number(insumo.tamanho_embalagem) || 1, 0.000001) : 1;
}

// Quantidade digitada (g, kg, ml, L, un) → unidade do cadastro do insumo ou do
// rendimento do pré-preparo. Grandezas incompatíveis devolvem null.
export function paraUnidadeDoCadastro(quantidade, unidadeDigitada, unidadeCadastro) {
  const q = parseNumero(quantidade);
  const de = String(unidadeDigitada || "").toLowerCase();
  const para = String(unidadeCadastro || "").toLowerCase();
  if (!de || de === para) return q;
  const massa = { g: 1, kg: 1000 }; const vol = { ml: 1, l: 1000 };
  if (massa[de] && massa[para]) return (q * massa[de]) / massa[para];
  if (vol[de] && vol[para]) return (q * vol[de]) / vol[para];
  if ((de === "porcao" || de === "un") && (para === "porcao" || para === "un")) return q;
  return null;
}

export function unidadesCompativeis(unidadeCadastro) {
  const u = String(unidadeCadastro || "").toLowerCase();
  if (u === "kg" || u === "g") return ["g", "kg"];
  if (u === "l" || u === "ml") return ["ml", "l"];
  return [u || "un"];
}

// ─── Custo técnico da marmita ────────────────────────────────────────────────

/**
 * itens:      [{ insumo_id | subficha_id, quantidade, fator_correcao }]
 *             quantidade na unidade do cadastro do insumo / do rendimento do pré-preparo
 * embalagens: [{ insumo_id, quantidade }]
 * fichas:     fichas da unidade com fichas_ingredientes(*, insumos(*)) — para os pré-preparos
 * insumos:    Map id → insumo
 */
export function custoDaMarmita({ itens = [], embalagens = [], fichas = [], insumos = new Map() } = {}) {
  const linhas = [];
  const pendencias = [];
  for (const it of itens) {
    const q = parseNumero(it.quantidade);
    if (it.subficha_id) {
      const base = fichas.find((f) => f.id === it.subficha_id);
      if (!base) { pendencias.push("Um pré-preparo da marmita não foi encontrado."); linhas.push({ ...it, tipo: "pre_preparo", nome: it.nome || "Pré-preparo", custo: null }); continue; }
      const custo = custoDeProduzirFicha({ id: "__linha", fichas_ingredientes: [{ subficha_id: base.id, quantidade: q, fator_correcao: it.fator_correcao }] }, fichas);
      const rend = parseNumero(base.rendimento_porcoes);
      if (!(rend > 0)) pendencias.push(`"${base.nome_receita}" está sem rendimento: informe quanto o lote rende.`);
      else if (!(custo > 0) && q > 0) pendencias.push(`"${base.nome_receita}" está sem custo: confira os ingredientes dele.`);
      linhas.push({ ...it, tipo: "pre_preparo", nome: base.nome_receita, unidade: base.rendimento_unidade, custo: r4(custo) });
    } else {
      const ins = insumos.get(it.insumo_id);
      if (!ins) { pendencias.push("Um ingrediente da marmita não foi encontrado no estoque."); linhas.push({ ...it, tipo: "ingrediente", nome: it.nome || "Ingrediente", custo: null }); continue; }
      const custo = custoDeProduzirFicha({ id: "__linha", fichas_ingredientes: [{ insumos: ins, quantidade: q, fator_correcao: it.fator_correcao }] }, fichas);
      if (!(custoUnitarioEfetivoInsumo(ins) > 0)) pendencias.push(`"${ins.nome}" está sem custo de compra no cadastro.`);
      linhas.push({ ...it, tipo: "ingrediente", nome: ins.nome, unidade: ins.unidade_medida, custo: r4(custo) });
    }
  }
  const linhasEmb = [];
  for (const e of embalagens) {
    const ins = insumos.get(e.insumo_id);
    const q = parseNumero(e.quantidade);
    if (!ins) { pendencias.push("Uma embalagem não foi encontrada no estoque."); linhasEmb.push({ ...e, custo: null }); continue; }
    const unit = custoUnitarioEfetivoInsumo(ins);
    if (!(unit > 0)) pendencias.push(`Embalagem "${ins.nome}" está sem custo no cadastro.`);
    linhasEmb.push({ ...e, nome: ins.nome, custoUnitario: r4(unit), custo: r4(unit * q) });
  }
  const alimentos = r2(soma(linhas.filter((l) => l.tipo === "ingrediente"), (l) => l.custo));
  const prePreparos = r2(soma(linhas.filter((l) => l.tipo === "pre_preparo"), (l) => l.custo));
  const emb = r2(soma(linhasEmb, (l) => l.custo));
  return {
    linhas, linhasEmbalagens: linhasEmb,
    alimentos, prePreparos, embalagens: emb,
    total: r2(alimentos + prePreparos + emb),
    pendencias: [...new Set(pendencias)],
    completo: pendencias.length === 0 && (linhas.length > 0),
  };
}

// ─── Canais de venda ─────────────────────────────────────────────────────────

// Modelos de canal: estrutura sem número. Taxa é contrato do dono — o sistema
// não presume comissão de ninguém.
export const MODELOS_CANAL = [
  { id: "ifood", nome: "iFood", modalidade: "", comissao_base: "receita", pagamento_na_comissao: false },
  { id: "whatsapp", nome: "WhatsApp", modalidade: "Entrega própria", comissao_base: "receita", pagamento_na_comissao: false },
  { id: "balcao", nome: "Balcão", modalidade: "Retirada", comissao_base: "receita", pagamento_na_comissao: false },
];

const CAMPOS_PCT = ["comissao_pct", "taxa_pagamento_pct", "promocao_pct"];
const CAMPOS_RS = ["taxa_fixa_pedido", "entrega_subsidiada_pedido"];

export function normalizarCanal(c = {}) {
  const id = String(c.id || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
  const out = {
    id, nome: String(c.nome || id).trim() || id, ativo: c.ativo !== false,
    modalidade: String(c.modalidade || "").trim(),
    comissao_base: c.comissao_base === "bruto" ? "bruto" : "receita",
    pagamento_na_comissao: !!c.pagamento_na_comissao,
    itens_por_pedido: Math.max(1, parseNumero(c.itens_por_pedido) || 1),
  };
  for (const k of [...CAMPOS_PCT, ...CAMPOS_RS]) {
    const v = c[k];
    out[k] = v === "" || v === null || v === undefined ? null : Math.max(0, parseNumero(v));
  }
  return out;
}

// Canal conta como configurado quando o dono preencheu ao menos as taxas que
// a modalidade cobra (zero digitado é configuração; campo vazio não é).
export function canalConfigurado(c) {
  const n = normalizarCanal(c);
  return n.comissao_pct !== null && (n.pagamento_na_comissao || n.taxa_pagamento_pct !== null);
}

export function validarCanal(c) {
  const n = normalizarCanal(c);
  const erros = [];
  if (!/^[a-z0-9_]{2,30}$/.test(n.id)) erros.push("Identificador do canal inválido (use letras minúsculas, ex.: ifood).");
  if (!n.nome) erros.push("Informe o nome do canal.");
  for (const k of CAMPOS_PCT) if (n[k] !== null && n[k] >= 100) erros.push(`${rotuloCampo(k)} precisa ser menor que 100%.`);
  return erros;
}

function rotuloCampo(k) {
  return ({ comissao_pct: "Comissão", taxa_pagamento_pct: "Taxa de pagamento", promocao_pct: "Promoção custeada" })[k] || k;
}

/**
 * Resultado de UMA marmita vendida num canal (por unidade vendida).
 *
 *   receita de vendas   = preço − promoção custeada pela empresa (desconto no preço)
 *   tributos            = receita de vendas × alíquota (uma vez só)
 *   comissão            = base (preço cheio ou receita) × comissão do canal
 *   taxa de pagamento   = receita × taxa, salvo quando o canal já cobra junto
 *                         da comissão (não soma duas vezes)
 *   taxa fixa e entrega = valor por pedido ÷ marmitas por pedido
 *   margem de contribuição = receita − tributos − taxas − custo técnico
 *
 * Percentuais sobre a RECEITA DE VENDAS. Margem de contribuição não é lucro:
 * ainda faltam CMO, despesas fixas e financeiras.
 */
export function resultadoPorCanal({ preco, custoTecnico, canal = {}, tributosPct = null } = {}) {
  const c = normalizarCanal(canal);
  const P = pos(preco);
  const custo = custoTecnico == null ? null : Math.max(0, parseNumero(custoTecnico));
  const avisos = [];
  if (!(P > 0)) return { valido: false, motivo: "Informe o preço de venda.", avisos };
  if (!canalConfigurado(c)) avisos.push(`Taxas do canal ${c.nome || ""} não configuradas: a margem considera taxa zero.`.replace("  ", " "));
  if (tributosPct === null || tributosPct === undefined || tributosPct === "") avisos.push("Alíquota de tributos não configurada: a margem considera tributo zero.");
  if (custo === null) avisos.push("Custo técnico indisponível.");

  const d = pct(c.promocao_pct);
  const promocao = P * d;
  const receita = P - promocao;
  const tributos = receita * pct(tributosPct);
  const comissao = (c.comissao_base === "bruto" ? P : receita) * pct(c.comissao_pct);
  const taxaPagamento = c.pagamento_na_comissao ? 0 : receita * pct(c.taxa_pagamento_pct);
  const taxaFixa = pos(c.taxa_fixa_pedido) / c.itens_por_pedido;
  const entrega = pos(c.entrega_subsidiada_pedido) / c.itens_por_pedido;
  const taxasCanal = comissao + taxaPagamento + taxaFixa;
  const variaveis = taxasCanal + entrega;
  const receitaLiquida = receita - tributos;
  const mc = custo === null ? null : receitaLiquida - variaveis - custo;
  return {
    valido: true, avisos,
    preco: r2(P), promocao: r2(promocao), receita: r2(receita), tributos: r2(tributos), receitaLiquida: r2(receitaLiquida),
    comissao: r2(comissao), taxaPagamento: r2(taxaPagamento), taxaFixa: r2(taxaFixa), entrega: r2(entrega),
    taxasCanal: r2(taxasCanal), variaveis: r2(variaveis), custo: r2(custo),
    margemContribuicao: r2(mc),
    margemContribuicaoPct: mc === null || !(receita > 0) ? null : r2((mc / receita) * 100),
    cmvTecnicoPct: custo === null || !(receita > 0) ? null : r2((custo / receita) * 100),
    markup: custo === null || !(custo > 0) ? null : r2(P / custo),
  };
}

/**
 * Preço que entrega a margem de contribuição-alvo (% da receita de vendas):
 *   P × [(1−d)(1−m) − k] = custo + taxa fixa + entrega
 * com k = tributos e taxas percentuais escritos como fração do preço.
 * Arredonda para cima, ao centavo.
 */
export function precoSugerido({ custoTecnico, canal = {}, tributosPct = null, margemAlvoPct } = {}) {
  const c = normalizarCanal(canal);
  const custo = custoTecnico == null ? null : parseNumero(custoTecnico);
  if (custo === null || !(custo > 0)) return { preco: null, motivo: "Sem custo técnico não há preço sugerido." };
  if (margemAlvoPct === null || margemAlvoPct === undefined || margemAlvoPct === "") return { preco: null, motivo: "Configure a margem-alvo em Configurações." };
  const m = parseNumero(margemAlvoPct) / 100;
  const d = pct(c.promocao_pct);
  const t = pct(tributosPct);
  const baseComissao = c.comissao_base === "bruto" ? 1 : (1 - d);
  const k = (1 - d) * t + baseComissao * pct(c.comissao_pct) + (c.pagamento_na_comissao ? 0 : (1 - d) * pct(c.taxa_pagamento_pct));
  const fixo = custo + pos(c.taxa_fixa_pedido) / c.itens_por_pedido + pos(c.entrega_subsidiada_pedido) / c.itens_por_pedido;
  const den = (1 - d) * (1 - m) - k;
  if (!(den > 0)) return { preco: null, motivo: "Com essas taxas e essa margem-alvo não existe preço possível: reduza a margem ou revise as taxas." };
  return { preco: Math.ceil((fixo / den) * 100) / 100, motivo: null };
}

// ─── Produção e compras ──────────────────────────────────────────────────────

const chaveIns = (id) => `i:${id}`;

/**
 * Do plano ("80 de frango, 40 de carne") à lista do que falta.
 *
 * plano:        [{ ficha_id, quantidade }]  (fichas de marmita da unidade)
 * marmitas:     Map ficha_id → { itens:[{insumo_id|subficha_id, quantidade, fator_correcao}], embalagens:[{insumo_id, quantidade}] }
 * fichas:       fichas da unidade (pré-preparos com fichas_ingredientes(*, insumos(*)))
 * insumos:      Map id → insumo
 * saldo:        Map insumo_id → saldo disponível NA UNIDADE DO CADASTRO
 * espelho:      Map ficha_id do pré-preparo → insumo_id do item de estoque dele
 *
 * Pré-preparo com saldo é usado antes de produzir mais; só a diferença vira
 * ingrediente. Assim o arroz que já está cozido não é comprado de novo.
 */
export function necessidadeDeProducao({ plano = [], marmitas = new Map(), fichas = [], insumos = new Map(), saldo = new Map(), espelho = new Map() } = {}) {
  const fichaPorId = new Map(fichas.map((f) => [f.id, f]));
  const precisaIns = new Map(); // insumo_id → { qtd, embalagem }
  const precisaPrep = new Map(); // ficha_id → qtd (unidade do rendimento)
  const avisos = [];
  const addIns = (id, q, embalagem = false) => {
    const a = precisaIns.get(id) || { qtd: 0, embalagem };
    a.qtd += q; a.embalagem = a.embalagem || embalagem;
    precisaIns.set(id, a);
  };
  const explodirLinha = (fi, vezes) => {
    const q = parseNumero(fi.quantidade) * vezes;
    if (!(q > 0)) return;
    if (fi.subficha_id) { precisaPrep.set(fi.subficha_id, (precisaPrep.get(fi.subficha_id) || 0) + q); return; }
    const ins = fi.insumos || insumos.get(fi.insumo_id);
    if (!ins) { avisos.push("Ingrediente sem cadastro numa das fichas."); return; }
    // perda/fator: compra-se o peso BRUTO (líquido × (1 + FC%))
    addIns(ins.id || fi.insumo_id, q * fatorDeCorrecaoNormalizado(fatorCorrecaoDoItem(ins, fi.fator_correcao)));
  };

  for (const p of plano) {
    const n = pos(p.quantidade);
    const m = marmitas.get(p.ficha_id);
    if (!n || !m) continue;
    for (const fi of m.itens || []) explodirLinha(fi, n);
    for (const e of m.embalagens || []) addIns(e.insumo_id, pos(e.quantidade) * n, true);
  }

  // Ordem topológica: quem usa vem antes de quem é usado, para que a demanda
  // de um pré-preparo esteja completa antes de descontar o saldo dele.
  const ordem = [];
  const visit = new Set();
  const temp = new Set();
  const dfs = (id) => {
    if (visit.has(id)) return;
    if (temp.has(id)) { avisos.push("Referência circular entre pré-preparos: revise as fichas."); return; }
    temp.add(id);
    for (const fi of fichaPorId.get(id)?.fichas_ingredientes || []) if (fi.subficha_id) dfs(fi.subficha_id);
    temp.delete(id); visit.add(id); ordem.push(id);
  };
  for (const id of [...precisaPrep.keys()]) dfs(id);
  ordem.reverse();

  const prePreparos = [];
  for (const id of ordem) {
    const f = fichaPorId.get(id);
    const necessario = precisaPrep.get(id) || 0;
    if (!f) { avisos.push("Pré-preparo de uma ficha não foi encontrado."); continue; }
    const espelhoId = espelho.get(id);
    const disponivel = espelhoId && saldo.has(espelhoId) ? Math.max(0, saldo.get(espelhoId)) : 0;
    const produzir = Math.max(0, necessario - disponivel);
    const rend = parseNumero(f.rendimento_porcoes);
    if (produzir > 0) {
      if (!(rend > 0)) avisos.push(`"${f.nome_receita}" sem rendimento: não dá para calcular os ingredientes.`);
      else for (const fi of f.fichas_ingredientes || []) explodirLinha(fi, produzir / rend);
    }
    prePreparos.push({
      ficha_id: id, nome: f.nome_receita, unidade: f.rendimento_unidade || "un",
      necessario: r4(necessario), disponivel: r4(disponivel), produzir: r4(produzir),
      lotes: rend > 0 ? r4(produzir / rend) : null,
    });
  }

  const itens = [];
  for (const [id, { qtd, embalagem }] of precisaIns) {
    const ins = insumos.get(id);
    const disponivel = saldo.has(id) ? Math.max(0, saldo.get(id)) : 0;
    const comprar = Math.max(0, qtd - disponivel);
    let valor = null;
    if (ins) {
      const unBase = unidadeNormalizada(ins.unidade_medida) || String(ins.unidade_medida || "un").toLowerCase();
      const v = custoIngrediente({ custoUnitario: custoUnitarioEfetivoInsumo(ins), quantidade: converterParaBaseDoInsumo(comprar, ins.unidade_medida, unBase) });
      valor = v > 0 || comprar === 0 ? r2(v) : null;
    }
    itens.push({
      insumo_id: id, nome: ins?.nome || "(sem cadastro)", unidade: ins?.unidade_medida || "un",
      tipo: embalagem ? "embalagem" : "ingrediente",
      necessario: r4(qtd), disponivel: r4(disponivel), comprar: r4(comprar), valorEstimado: valor,
    });
  }
  itens.sort((a, b) => (b.comprar > 0) - (a.comprar > 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  const faltam = itens.filter((i) => i.comprar > 0);
  return {
    itens, prePreparos, avisos: [...new Set(avisos)],
    listaDeCompras: faltam,
    valorEstimadoCompras: faltam.some((i) => i.valorEstimado === null) ? null : r2(soma(faltam, (i) => i.valorEstimado)),
  };
}

/**
 * Baixas de estoque de uma produção: ingrediente direto, o PRÓPRIO pré-preparo
 * (não os ingredientes dele, que já saíram quando ele foi produzido) e as
 * embalagens. Quantidade na unidade do saldo (g/ml/un).
 *
 * saldos: Map insumo_id → [{ estoque_id, estoque_nome, saldo (unidade do saldo), prioridade }]
 *         (menor prioridade primeiro: estoque da marmitaria antes do da cozinha)
 */
export function baixasDaProducao({ marmita, quantidade, fichas = [], insumos = new Map(), espelho = new Map(), saldos = new Map() } = {}) {
  if (!pos(quantidade) || !marmita) return { baixas: [], faltas: ["Informe a marmita e a quantidade."] };
  const { precisa, faltas } = consumoDaMarmita({ marmita, quantidade, fichas, insumos, espelho });

  const baixas = [];
  for (const [insumoId, { q, nome }] of precisa) {
    const qtd = Math.round(q * 1000) / 1000;
    const locais = [...(saldos.get(insumoId) || [])].sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9));
    const local = locais.find((l) => parseNumero(l.saldo) >= qtd);
    if (!local) {
      const melhor = locais.reduce((m, l) => Math.max(m, parseNumero(l.saldo)), 0);
      faltas.push(`${nome}: precisa de ${qtd} e o maior saldo num estoque é ${melhor}.`);
      continue;
    }
    baixas.push({ estoque_id: local.estoque_id, estoque_nome: local.estoque_nome, insumo_id: insumoId, nome, quantidade: qtd });
  }
  return { baixas, faltas };
}

/**
 * Quanto de cada item de estoque N marmitas consomem (unidade do saldo):
 * ingrediente direto com fator de correção, o PRÓPRIO pré-preparo (pelo item
 * espelho) e as embalagens. Base da baixa da produção e da baixa por pedido.
 *   → { precisa: Map insumo_id → { q, nome }, faltas: [texto] }
 */
export function consumoDaMarmita({ marmita, quantidade, fichas = [], insumos = new Map(), espelho = new Map() } = {}) {
  const n = pos(quantidade);
  const precisa = new Map();
  const faltas = [];
  const fichaPorId = new Map(fichas.map((f) => [f.id, f]));
  const add = (insumoId, qCadastro, nome) => {
    const ins = insumos.get(insumoId);
    const qSaldo = qCadastro * fatorSaldo(ins);
    const a = precisa.get(insumoId) || { q: 0, nome: nome || ins?.nome || "Item" };
    a.q += qSaldo;
    precisa.set(insumoId, a);
  };
  if (!n || !marmita) return { precisa, faltas };
  for (const fi of marmita.itens || []) {
    const q = parseNumero(fi.quantidade) * n;
    if (!(q > 0)) continue;
    if (fi.subficha_id) {
      const id = espelho.get(fi.subficha_id);
      const nome = fichaPorId.get(fi.subficha_id)?.nome_receita || "Pré-preparo";
      if (!id) { faltas.push(`"${nome}" não tem item de estoque de pré-preparo.`); continue; }
      add(id, q, nome);
    } else {
      const ins = insumos.get(fi.insumo_id);
      add(fi.insumo_id, q * fatorDeCorrecaoNormalizado(fatorCorrecaoDoItem(ins, fi.fator_correcao)));
    }
  }
  for (const e of marmita.embalagens || []) add(e.insumo_id, pos(e.quantidade) * n);
  return { precisa, faltas };
}

// ─── CMO da marmitaria ───────────────────────────────────────────────────────

// Percentuais legais conhecidos (não são estimativa de mercado):
//   FGTS 8%; 13º = 1/12 = 8,33%; férias + 1/3 = 1/12 × 4/3 = 11,11%.
// INSS patronal depende do regime (Simples anexos I–III recolhe no DAS) e vem
// da configuração do RH (rh_config_trabalhista) ou do dono.
export const ENCARGOS_LEGAIS = { fgts_pct: 8, provisao_13_pct: 8.33, provisao_ferias_pct: 11.11 };

export function encargosDaConfig(config = {}, rhConfig = null) {
  const anexo = String(rhConfig?.anexo_simples || "").toUpperCase();
  const inssPadrao = anexo === "IV" ? 20 + pos(rhConfig?.rat_pct) * (pos(rhConfig?.fap) || 1) + pos(rhConfig?.terceiros_pct) : 0;
  const v = (k, padrao) => (config[k] === undefined || config[k] === null || config[k] === "" ? padrao : Math.max(0, parseNumero(config[k])));
  return {
    fgts_pct: v("fgts_pct", ENCARGOS_LEGAIS.fgts_pct),
    inss_patronal_pct: v("inss_patronal_pct", inssPadrao),
    provisao_13_pct: v("provisao_13_pct", ENCARGOS_LEGAIS.provisao_13_pct),
    provisao_ferias_pct: v("provisao_ferias_pct", ENCARGOS_LEGAIS.provisao_ferias_pct),
    criterio: config.criterio === "horas" ? "horas" : "percentual",
    origemInss: config.inss_patronal_pct !== undefined && config.inss_patronal_pct !== null && config.inss_patronal_pct !== ""
      ? "configurado" : anexo ? `RH (Simples anexo ${anexo})` : "não informado (considerado 0%)",
  };
}

const ehExtra = (c) => String(c?.tipo_contrato || "") === "Freelancer";
const ativoColab = (c) => (c?.status || "ativo") !== "inativo" && !c?.data_desligamento;

/**
 * alocacoes: marmitaria_rh_alocacoes ativas [{ colaborador_id, tipo_alocacao, percentual_tempo, horas_por_semana }]
 * colaboradores: cadastro do RH (o mesmo, sem duplicar)
 * recibos: rh_recibos_prestacao (diárias) — pagos no mês
 * horasSemanaPadrao: jornada contratual para o critério "horas" (44 h)
 *
 * Cada salário entra UMA vez: a parte da marmitaria é a fração alocada; o
 * restante continua no restaurante (campo `restaurante`).
 */
/**
 * unidadeId + exclusiva (unidade só da marmitaria): todo funcionário ATIVO da
 * unidade entra 100% sem precisar de alocação; quem é de OUTRA unidade da
 * empresa e está alocado aqui é "cedido" — custo gerencial da marmitaria, mas
 * o salário continua pago (e contado) na unidade de origem. totalCedido serve
 * para a visão consolidada não contar duas vezes.
 */
export function cmoMarmitaria({ alocacoes = [], colaboradores = [], recibos = [], encargos, mes, horasSemanaPadrao = 44, marmitasVendidas = null, unidadeId = null, exclusiva = false } = {}) {
  const enc = encargos || encargosDaConfig();
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const linhas = [];
  const avisos = [];
  const ativas = alocacoes.filter((x) => x.ativo !== false);
  if (exclusiva && unidadeId) {
    const ja = new Set(alocacoes.map((a) => a.colaborador_id));
    for (const c of colaboradores) {
      if (c.unidade_id === unidadeId && ativoColab(c) && !ja.has(c.id)) ativas.push({ colaborador_id: c.id, tipo_alocacao: "exclusivo", implicita: true });
    }
  }
  for (const a of ativas) {
    const c = porId.get(a.colaborador_id);
    if (!c) { avisos.push("Uma alocação aponta para colaborador que não existe mais no RH."); continue; }
    if (!ativoColab(c)) { avisos.push(`${c.nome} está desligado(a) e continua alocado(a): revise.`); continue; }
    let fracao;
    if (a.tipo_alocacao === "exclusivo") fracao = 1;
    else if (enc.criterio === "horas") fracao = Math.min(1, pos(a.horas_por_semana) / (pos(horasSemanaPadrao) || 44));
    else fracao = Math.min(1, pos(a.percentual_tempo) / 100);
    let salario = 0, encargosV = 0, provisoes = 0, beneficios = 0, extras = 0;
    if (!ehExtra(c)) {
      salario = pos(c.salario);
      if (!(salario > 0)) avisos.push(`${c.nome} está sem salário no cadastro do RH.`);
      encargosV = salario * (pct(enc.fgts_pct) + pct(enc.inss_patronal_pct));
      provisoes = salario * (pct(enc.provisao_13_pct) + pct(enc.provisao_ferias_pct)) * (1 + pct(enc.fgts_pct) + pct(enc.inss_patronal_pct));
      beneficios = pos(c.vale_alimentacao) + (c.usa_vale_transporte ? pos(c.vale_transporte_val) : 0);
    }
    extras = soma((recibos || []).filter((r) => r.colaborador_id === c.id && r.pagamento_realizado
      && String(r.data_pagamento || r.data_trabalho || "").slice(0, 7) === mes), (r) => r.valor_total);
    const total = salario + encargosV + provisoes + beneficios + extras;
    const cedido = !!(unidadeId && c.unidade_id && c.unidade_id !== unidadeId);
    linhas.push({
      colaborador_id: c.id, nome: c.nome, cargo: c.cargo || "", tipo: a.tipo_alocacao === "exclusivo" ? "exclusivo" : "compartilhado",
      cedido, unidadeOrigem: cedido ? c.unidade_id : null, implicita: !!a.implicita,
      fracaoPct: r2(fracao * 100), salario: r2(salario), encargos: r2(encargosV), provisoes: r2(provisoes),
      beneficios: r2(beneficios), extras: r2(extras), custoTotal: r2(total),
      marmitaria: r2(total * fracao), restaurante: r2(total * (1 - fracao)),
    });
  }
  const total = r2(soma(linhas, (l) => l.marmitaria));
  return {
    linhas, avisos, natureza: "estimativa", encargos: enc,
    total, restaurante: r2(soma(linhas, (l) => l.restaurante)),
    totalCedido: r2(soma(linhas.filter((l) => l.cedido), (l) => l.marmitaria)),
    porMarmita: marmitasVendidas > 0 ? r2(total / marmitasVendidas) : null,
    motivoPorMarmita: marmitasVendidas > 0 ? null : "Sem marmitas vendidas lançadas no mês.",
  };
}

// ─── CMV real do estoque da marmitaria ───────────────────────────────────────

/**
 * CMV real = estoque inicial + compras líquidas + transferências de entrada
 *            − transferências de saída − estoque final
 * restrito aos estoques da marmitaria. Inicial e final são contagens fechadas
 * DESSES estoques nas fronteiras do período. Sem elas: não apurado, com motivo.
 *
 * movimentos: estoque_movimentacoes_multi dos estoques (tipo, motivo, quantidade, valor_total, insumo_id, estoque_id, data_movimento)
 * custoPorBase: (insumo_id) → R$ por unidade do saldo, para movimento sem valor (marcado estimado)
 */
export function cmvRealDosEstoques({ de, ateExclusivo, estoqueIds = [], contagens = [], itensPorContagem = new Map(), compras = [], comprasItens = [], movimentos = [], custoPorBase = () => null } = {}) {
  const ids = new Set(estoqueIds);
  const motivos = [];
  if (!ids.size) return { valor: null, status: "nao_apurado", motivos: ["O estoque da marmitaria ainda não foi ativado."] };
  const fechadas = contagens.filter((c) => c.status === "fechada" && ids.has(c.estoque_id));
  const naFronteira = (data) => {
    const porEstoque = new Map();
    for (const c of fechadas) {
      if (fronteiraDaContagem(c).data !== data) continue;
      const atual = porEstoque.get(c.estoque_id);
      if (!atual || String(c.fechada_em || "") > String(atual.fechada_em || "")) porEstoque.set(c.estoque_id, c);
    }
    return porEstoque;
  };
  const ini = naFronteira(de);
  const fim = naFronteira(ateExclusivo);
  const fmt = (iso) => iso.split("-").reverse().join("/");
  if (ini.size < ids.size) motivos.push(`Falta a contagem fechada do estoque da marmitaria no início do período (${fmt(de)}).`);
  if (fim.size < ids.size) motivos.push(`Falta a contagem fechada do estoque da marmitaria no fim do período (${fmt(somarDiasIso(ateExclusivo, -1))}).`);
  const valorContagens = (mapa) => soma([...mapa.values()].flatMap((c) => itensPorContagem.get(c.id) || []),
    (i) => i.valor_total ?? parseNumero(i.quantidade_contada) * parseNumero(i.custo_unitario));

  const itensDosEstoques = comprasItens.filter((i) => ids.has(i.estoque_id));
  const cp = comprasDaJanela(compras, itensDosEstoques, de, ateExclusivo);
  const valorCompras = soma(cp.itens, (i) => i.valor_rateado);

  let estimados = 0;
  const valorMov = (m) => {
    if (m.valor_total != null) return parseNumero(m.valor_total);
    const c = custoPorBase(m.insumo_id);
    if (c == null) return null;
    estimados++;
    return parseNumero(m.quantidade) * c;
  };
  const daJanela = movimentos.filter((m) => {
    const d = String(m.data_movimento || m.created_at || "").slice(0, 10);
    return d >= de && d < ateExclusivo && ids.has(m.estoque_id) && !m.estorno_de_id;
  });
  const estornados = new Set(movimentos.filter((m) => m.estorno_de_id).map((m) => m.estorno_de_id));
  const validos = daJanela.filter((m) => !estornados.has(m.id));
  const entradas = validos.filter((m) => m.tipo === "entrada" && ["transferencia_recebida", "recebimento", "devolucao"].includes(m.motivo));
  const saidas = validos.filter((m) => m.tipo === "saida" && m.motivo === "transferencia_enviada");
  // transferência entre dois estoques da própria marmitaria não entra nem sai
  const internos = new Set(validos.filter((m) => m.transferencia_id && ids.has(m.estoque_destino_id)).map((m) => m.transferencia_id));
  const externos = (xs) => xs.filter((m) => !(m.transferencia_id && internos.has(m.transferencia_id)));
  const vEntradas = externos(entradas).map(valorMov);
  const vSaidas = externos(saidas).map(valorMov);
  if (vEntradas.includes(null) || vSaidas.includes(null)) motivos.push("Há transferência sem valor e sem custo no cadastro do produto.");

  const apurado = motivos.length === 0;
  const ei = ini.size === ids.size ? r2(valorContagens(ini)) : null;
  const ef = fim.size === ids.size ? r2(valorContagens(fim)) : null;
  const te = vEntradas.includes(null) ? null : r2(soma(vEntradas));
  const ts = vSaidas.includes(null) ? null : r2(soma(vSaidas));
  return {
    status: apurado ? "apurado" : "nao_apurado",
    natureza: apurado ? (estimados ? "estimativa" : "real") : null,
    motivos,
    estoqueInicial: ei, compras: r2(valorCompras), transferenciasEntrada: te, transferenciasSaida: ts, estoqueFinal: ef,
    valor: apurado ? r2(ei + valorCompras + te - ts - ef) : null,
    movimentosEstimados: estimados,
  };
}

// ─── Vendas ──────────────────────────────────────────────────────────────────

export function vendasDoPeriodo(vendas = [], de, ateInclusivo) {
  return vendas.filter((v) => { const d = String(v.data).slice(0, 10); return d >= de && d <= ateInclusivo; });
}

export function resumoVendas(vendas = []) {
  const bruto = soma(vendas, (v) => v.valor_bruto);
  const descontos = soma(vendas, (v) => v.descontos);
  const cancelamentos = soma(vendas, (v) => v.cancelamentos);
  const receita = bruto - descontos - cancelamentos;
  const porCanal = new Map();
  for (const v of vendas) {
    const a = porCanal.get(v.canal) || { canal: v.canal, quantidade: 0, bruto: 0, receita: 0 };
    a.quantidade += parseNumero(v.quantidade);
    a.bruto += parseNumero(v.valor_bruto);
    a.receita += parseNumero(v.valor_bruto) - parseNumero(v.descontos) - parseNumero(v.cancelamentos);
    porCanal.set(v.canal, a);
  }
  return {
    lancamentos: vendas.length,
    quantidade: r2(soma(vendas, (v) => v.quantidade)),
    bruto: r2(bruto), descontos: r2(descontos), cancelamentos: r2(cancelamentos), receita: r2(receita),
    comissao: r2(soma(vendas, (v) => v.comissao)), taxaPagamento: r2(soma(vendas, (v) => v.taxa_pagamento)),
    entrega: r2(soma(vendas, (v) => v.entrega_subsidiada)), promocoes: r2(soma(vendas, (v) => v.promocoes)),
    outrasTaxas: r2(soma(vendas, (v) => v.outras_taxas)),
    taxasEstimadas: vendas.some((v) => v.taxas_estimadas),
    porCanal: [...porCanal.values()].map((c) => ({ ...c, quantidade: r2(c.quantidade), bruto: r2(c.bruto), receita: r2(c.receita) })),
  };
}

// Custo previsto pela ficha das marmitas vendidas (CMV teórico).
export function cmvPrevisto(vendas = [], custoPorFicha = new Map()) {
  let valor = 0; let semFicha = 0; let semCusto = 0;
  for (const v of vendas) {
    const q = parseNumero(v.quantidade);
    if (!q) continue;
    if (!v.ficha_id) { semFicha += q; continue; }
    const c = custoPorFicha.get(v.ficha_id);
    if (!(c > 0)) { semCusto += q; continue; }
    valor += c * q;
  }
  const motivos = [];
  if (semFicha) motivos.push(`${r2(semFicha)} marmita(s) vendida(s) sem a marmita identificada.`);
  if (semCusto) motivos.push(`${r2(semCusto)} marmita(s) vendida(s) com ficha sem custo completo.`);
  return { valor: motivos.length ? null : r2(valor), parcial: r2(valor), motivos };
}

/** Ranking por marmita: quantidade, receita e margem unitária prevista. */
export function rankingMarmitas(vendas = [], fichas = new Map()) {
  const m = new Map();
  for (const v of vendas) {
    if (!v.ficha_id) continue;
    const a = m.get(v.ficha_id) || { ficha_id: v.ficha_id, quantidade: 0, receita: 0 };
    a.quantidade += parseNumero(v.quantidade);
    a.receita += parseNumero(v.valor_bruto) - parseNumero(v.descontos) - parseNumero(v.cancelamentos);
    m.set(v.ficha_id, a);
  }
  return [...m.values()].map((a) => ({ ...a, nome: fichas.get(a.ficha_id)?.nome || "Marmita removida", quantidade: r2(a.quantidade), receita: r2(a.receita) }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

// ─── DRE da marmitaria ───────────────────────────────────────────────────────

// Grupos de despesas operacionais pedidos pelo dono, a partir do plano de contas.
const GRUPO_OPERACIONAL = {
  utilidades_energia: "Energia", utilidades_agua: "Água", utilidades_gas: "Gás",
  ocupacao_aluguel: "Aluguel", ocupacao_condominio: "Aluguel", marketing: "Marketing",
  adm_sistemas: "Sistemas", manutencao: "Manutenção",
};
const CENTROS_COMPARTILHADOS = new Set(["", "geral", "administrativo"]);
const TAXA_CANAL = new Set(["com_comissao_marketplace", "com_taxa_cartao"]);
const FORA = new Set(["mercadoria", "investimento", "distribuicao", "perda_estoque"]);

/**
 * Classifica as contas do mês para a marmitaria:
 *   direta      centro de custo da marmitaria (centros_diretos) → 100%
 *   rateio      centro compartilhado (geral, administrativo, sem centro) → % configurado
 *   fora        centro de outra operação (cozinha, bar, salão, eventos) → 0%
 * A política fica explícita em cada linha (`criterio`).
 *
 * Unidade só da marmitaria (centrosDiretos contém "*"): a marmitaria é um
 * negócio separado, com unidade própria — toda conta da unidade é dela (100%),
 * sem rateio com outro negócio.
 */
export const UNIDADE_EXCLUSIVA = "*";
export const unidadeExclusiva = (cfg = {}) => Array.isArray(cfg.centros_diretos) && cfg.centros_diretos.includes(UNIDADE_EXCLUSIVA);

export function contasDaMarmitaria(contas = [], mes, { centrosDiretos = ["marmitaria"], rateio = {} } = {}) {
  const diretos = new Set(centrosDiretos.map((c) => String(c).toLowerCase()));
  const exclusiva = diretos.has(UNIDADE_EXCLUSIVA);
  const padrao = rateio?.padrao_pct === undefined || rateio?.padrao_pct === null || rateio?.padrao_pct === "" ? null : Math.max(0, Math.min(100, parseNumero(rateio.padrao_pct)));
  const porCat = rateio?.por_categoria || {};
  const out = [];
  for (const c of contas) {
    if (c?.situacao === "cancelado") continue;
    if (String(c?.competencia_efetiva || "").slice(0, 7) !== mes) continue;
    const centro = String(c.centro_custo_codigo || "").toLowerCase();
    let fracao = 0; let criterio;
    if (exclusiva) { fracao = 1; criterio = "unidade_exclusiva"; }
    else if (diretos.has(centro)) { fracao = 1; criterio = "direta"; }
    else if (CENTROS_COMPARTILHADOS.has(centro)) {
      const especifico = porCat[c.categoria_codigo];
      const p = especifico === undefined || especifico === null || especifico === "" ? padrao : Math.max(0, Math.min(100, parseNumero(especifico)));
      if (p === null) { criterio = "rateio_nao_configurado"; fracao = 0; }
      else { fracao = p / 100; criterio = `rateio ${r2(p)}%`; }
    } else { criterio = "outra_operacao"; fracao = 0; }
    out.push({ ...c, fracao, criterio, valorMarmitaria: r2(parseNumero(c.valor_original) * fracao) });
  }
  return out;
}

/**
 * DRE gerencial da marmitaria (um mês). Percentuais sobre a receita de vendas.
 *   vendas:  marmitaria_vendas do mês
 *   contas:  contasDaMarmitaria(...)
 *   cmvReal: cmvRealDosEstoques(...); cmvPrev: cmvPrevisto(...) — usado só se o real faltar, marcado ESTIMATIVA
 *   cmo:     cmoMarmitaria(...)
 */
export function dreMarmitaria({ vendas = [], contas = [], cmvReal = null, cmvPrev = null, cmo = null, tributosPct = null, nomesCategoria = new Map(), nomesCanal = new Map() } = {}) {
  const rv = resumoVendas(vendas);
  const linhas = [];
  const alertas = [];
  const temVendas = vendas.length > 0;
  const base = temVendas ? rv.receita : null;
  const P = (v) => (v === null || base === null || !(base > 0) ? null : r2((v / base) * 100));
  const add = (id, rotulo, valor, { tipo = "linha", natureza = "real", nota = null, filhos = [] } = {}) => {
    linhas.push({ id, rotulo, valor: valor === null ? null : r2(valor), tipo, natureza: valor === null ? "sem_dado" : natureza, nota, pct: P(valor),
      filhos: filhos.map((f) => ({ ...f, valor: r2(f.valor), pct: P(f.valor) })) });
    return valor === null ? null : r2(valor);
  };
  const menos = (a, ...bs) => (a === null || bs.some((b) => b === null) ? null : a - soma(bs));
  const nomeCat = (c) => nomesCategoria.get(c) || c || "Sem categoria";

  if (!temVendas) alertas.push("Nenhuma venda da marmitaria lançada no período: lance as vendas em Financeiro → Vendas.");

  // Receitas
  add("vendas_brutas", "Vendas brutas", temVendas ? rv.bruto : null, {
    filhos: rv.porCanal.map((c) => ({ rotulo: nomesCanal.get(c.canal) || c.canal, valor: c.bruto, natureza: "real" })),
    nota: temVendas ? null : "Sem vendas lançadas.",
  });
  add("descontos", "(−) Descontos", temVendas ? rv.descontos : null);
  add("cancelamentos", "(−) Cancelamentos e estornos", temVendas ? rv.cancelamentos : null);
  const receita = add("receita_vendas", "(=) Receita de vendas", base, { tipo: "subtotal", nota: temVendas ? "base dos percentuais" : null });

  // Tributos: lançados na venda; senão, alíquota configurada (estimativa)
  const linhasComTributo = vendas.filter((v) => v.tributos !== null && v.tributos !== undefined);
  let tributos;
  if (!temVendas) tributos = add("tributos", "(−) Tributos sobre vendas", null);
  else if (linhasComTributo.length === vendas.length) tributos = add("tributos", "(−) Tributos sobre vendas", soma(vendas, (v) => v.tributos), { nota: "lançados nas vendas" });
  else if (tributosPct !== null && tributosPct !== undefined && tributosPct !== "") {
    const lancados = soma(linhasComTributo, (v) => v.tributos);
    const restoBase = soma(vendas.filter((v) => v.tributos === null || v.tributos === undefined), (v) => parseNumero(v.valor_bruto) - parseNumero(v.descontos) - parseNumero(v.cancelamentos));
    tributos = add("tributos", "(−) Tributos sobre vendas", lancados + restoBase * pct(tributosPct), { natureza: "estimado", nota: `${r2(parseNumero(tributosPct))}% configurado sobre a receita sem tributo lançado` });
  } else {
    tributos = add("tributos", "(−) Tributos sobre vendas", null, { nota: "Configure a alíquota em Configurações ou lance o tributo na venda." });
    alertas.push("Tributos sobre vendas sem dado: configure a alíquota da marmitaria.");
  }
  const receitaLiquida = add("receita_liquida", "(=) Receita líquida", menos(receita, tributos), { tipo: "subtotal" });

  // CMV
  let cmv = null;
  if (cmvReal?.valor != null) {
    cmv = add("cmv", "(−) CMV real", cmvReal.valor, { natureza: cmvReal.natureza === "estimativa" ? "estimado" : "real",
      nota: `estoque inicial + compras + transferências recebidas − enviadas − estoque final${cmvReal.movimentosEstimados ? " (transferências sem valor estimadas pelo custo do cadastro)" : ""}` });
  } else if (cmvPrev?.valor != null) {
    cmv = add("cmv", "(−) CMV previsto pela ficha técnica", cmvPrev.valor, { natureza: "estimado",
      nota: `CMV real não apurado: ${(cmvReal?.motivos || []).join(" ")} Valor previsto = marmitas vendidas × custo da ficha.` });
    alertas.push("CMV real não apurado: o resultado usa o custo previsto das fichas (estimativa).");
  } else {
    cmv = add("cmv", "(−) CMV", null, { nota: [...(cmvReal?.motivos || []), ...(cmvPrev?.motivos || [])].join(" ") || "Sem dados de custo." });
  }
  const lucroBruto = add("lucro_bruto", "(=) Lucro bruto", menos(receitaLiquida, cmv), { tipo: "subtotal" });

  // Custos variáveis
  const contasVar = contas.filter((c) => c.natureza === "custo_variavel" && c.valorMarmitaria > 0);
  const vendasTemTaxas = rv.comissao + rv.taxaPagamento > 0;
  const ignoradas = vendasTemTaxas ? contasVar.filter((c) => TAXA_CANAL.has(c.categoria_codigo)) : [];
  const contasVarUsadas = contasVar.filter((c) => !ignoradas.includes(c));
  const naturezaTaxas = rv.taxasEstimadas ? "estimado" : "real";
  const filhosVar = temVendas ? [
    { rotulo: "Comissões dos canais (iFood etc.)", valor: rv.comissao + rv.outrasTaxas, natureza: naturezaTaxas },
    { rotulo: "Taxas de pagamento", valor: rv.taxaPagamento, natureza: naturezaTaxas },
    { rotulo: "Entrega subsidiada", valor: rv.entrega, natureza: "real" },
    { rotulo: "Promoções custeadas pela empresa", valor: rv.promocoes, natureza: "real" },
  ] : [];
  for (const [cod, valor] of agruparValor(contasVarUsadas, (c) => c.categoria_codigo)) filhosVar.push({ rotulo: `${nomeCat(cod)} (contas a pagar)`, valor, natureza: "real" });
  const variaveis = add("variaveis", "(−) Custos variáveis de venda", temVendas || contasVarUsadas.length ? soma(filhosVar, (f) => f.valor) : null, {
    filhos: filhosVar, natureza: filhosVar.some((f) => f.natureza === "estimado") ? "estimado" : "real",
    nota: ignoradas.length ? `${ignoradas.length} conta(s) de comissão/taxa de cartão não somada(s): as taxas já vêm das vendas.` : null,
  });
  const mc = add("contribuicao", "(=) Margem de contribuição", menos(lucroBruto, variaveis), { tipo: "subtotal" });

  // Custos operacionais
  const filhosOp = [];
  if (cmo && cmo.linhas?.length) filhosOp.push({ rotulo: "CMO (mão de obra alocada)", valor: cmo.total, natureza: "estimado" });
  const pessoalContas = contas.filter((c) => c.natureza === "pessoal" && c.valorMarmitaria > 0);
  let notaPessoal = null;
  if (cmo && cmo.linhas?.length) {
    if (pessoalContas.length) notaPessoal = `${pessoalContas.length} conta(s) de pessoal da marmitaria não somada(s): o CMO vem do RH.`;
  } else if (pessoalContas.length) {
    filhosOp.push({ rotulo: "Pessoal (contas a pagar)", valor: soma(pessoalContas, (c) => c.valorMarmitaria), natureza: "real" });
  } else {
    alertas.push("Sem CMO: aloque os funcionários da marmitaria em Funcionários.");
  }
  const conhecidas = new Set(["deducao_receita", "custo_variavel", "pessoal", "financeiro", ...FORA]);
  const opContas = contas.filter((c) => !conhecidas.has(c.natureza) && c.valorMarmitaria > 0);
  for (const [grupo, valor] of agruparValor(opContas, (c) => GRUPO_OPERACIONAL[c.categoria_codigo] || "Outras despesas")) {
    const rateado = opContas.some((c) => (GRUPO_OPERACIONAL[c.categoria_codigo] || "Outras despesas") === grupo && c.criterio.startsWith("rateio"));
    filhosOp.push({ rotulo: rateado ? `${grupo} (inclui rateio)` : grupo, valor, natureza: "real" });
  }
  const semRateio = contas.filter((c) => c.criterio === "rateio_nao_configurado");
  if (semRateio.length) alertas.push(`${semRateio.length} despesa(s) compartilhada(s) sem critério de rateio: configure o % em Configurações (hoje entram como 0%).`);
  const operacionais = add("operacionais", "(−) Custos operacionais", soma(filhosOp, (f) => f.valor), {
    filhos: filhosOp, nota: notaPessoal, natureza: filhosOp.some((f) => f.natureza === "estimado") ? "estimado" : "real",
  });
  const resultadoOp = add("resultado_operacional", "(=) Resultado operacional", menos(mc, operacionais), { tipo: "subtotal" });
  const finContas = contas.filter((c) => c.natureza === "financeiro" && c.valorMarmitaria > 0);
  const financeiro = finContas.length ? add("financeiro", "(−) Despesas financeiras", soma(finContas, (c) => c.valorMarmitaria)) : 0;
  const lucro = add("lucro_liquido", "(=) Lucro líquido gerencial", menos(resultadoOp, financeiro), { tipo: "resultado" });

  const taxasVendas = temVendas ? r2(rv.comissao + rv.outrasTaxas + rv.taxaPagamento + rv.entrega + rv.promocoes) : null;
  const fixos = operacionais + (financeiro || 0);
  const mcPct = mc === null || !(receita > 0) ? null : mc / receita;
  const ticket = rv.quantidade > 0 && receita !== null ? receita / rv.quantidade : null;
  const pe = mcPct === null || !(mcPct > 0) ? null : fixos / mcPct;
  const estimado = linhas.some((l) => l.natureza === "estimado");
  return {
    linhas, alertas,
    natureza: linhas.some((l) => l.natureza === "sem_dado" && ["cmv", "tributos", "receita_vendas"].includes(l.id)) ? "sem_dado" : estimado ? "estimado" : "real",
    indicadores: {
      taxasVendas, tributos,
      marmitas: temVendas ? rv.quantidade : null,
      receita, receitaLiquida, cmv, cmvPct: P(cmv), lucroBruto, margemBrutaPct: P(lucroBruto),
      margemContribuicao: mc, margemContribuicaoPct: P(mc), cmo: cmo?.linhas?.length ? cmo.total : null, cmoPct: cmo?.linhas?.length ? P(cmo.total) : null,
      resultadoOperacional: resultadoOp, lucroLiquido: lucro, margemLiquidaPct: P(lucro),
      pontoEquilibrio: pe === null ? null : r2(pe),
      pontoEquilibrioMarmitas: pe === null || !(ticket > 0) ? null : Math.ceil(pe / ticket),
      motivoPontoEquilibrio: pe === null ? (mcPct !== null && mcPct <= 0 ? "Margem de contribuição negativa: não há ponto de equilíbrio." : "Depende da margem de contribuição apurada.") : null,
    },
  };
}

/**
 * Consolidado = DRE gerencial da unidade (dre-gerencial.mjs, intocado) + só o
 * que ele não enxerga da marmitaria. O DRE da unidade já soma todas as contas
 * a pagar (inclusive as da marmitaria e as compartilhadas), a folha inteira do
 * RH e o CMV do inventário geral (todos os estoques). Então a marmitaria
 * acrescenta apenas: as vendas dela (fonte separada), os tributos dessas
 * vendas e as taxas que vêm nessas vendas. Nada é contado duas vezes.
 *
 * Política (vale anunciar na tela): as vendas da marmitaria NÃO entram no
 * faturamento diário do restaurante; entram em Marmitaria → Vendas.
 */
export function dreConsolidado({ unidade, marmitaria } = {}) {
  const u = (id, ausenteZero = false) => {
    const l = unidade?.linhas?.find((x) => x.id === id);
    if (!l) return ausenteZero ? 0 : null;
    return l.valor;
  };
  const im = marmitaria?.indicadores || {};
  const somar = (a, b) => (a === null || b === null || a === undefined || b === undefined ? null : r2(a + b));
  const menos = (a, ...bs) => (a === null || bs.some((b) => b === null) ? null : r2(a - soma(bs)));
  const linhas = [];
  const add = (id, rotulo, un, marm, tipo = "linha", nota = null) => {
    const cons = un === null || marm === null ? null : r2(un + marm);
    linhas.push({ id, rotulo, unidade: un === null ? null : r2(un), marmitaria: marm === null ? null : r2(marm), consolidado: cons, tipo, nota });
    return cons;
  };
  const receita = add("receita", "Receita de vendas", u("faturamento"), im.receita ?? null, "subtotal");
  const tributos = add("tributos", "(−) Tributos sobre vendas", u("impostos"), im.tributos ?? null);
  const rl = add("receita_liquida", "(=) Receita líquida", menos(u("faturamento"), u("impostos")), menos(im.receita ?? null, im.tributos ?? null), "subtotal");
  const cmv = add("cmv", "(−) CMV real", u("cmv"), 0, "linha", "O inventário geral da unidade já conta os estoques da marmitaria.");
  const variaveis = add("variaveis", "(−) Custos variáveis", u("variaveis"), im.taxasVendas ?? null, "linha", "Marmitaria: taxas e promoções das vendas dela (as contas a pagar já estão na unidade).");
  // o que a marmitaria acrescenta ao resultado da unidade: vendas − tributos − taxas dessas vendas
  const acrescimo = menos(im.receita ?? null, im.tributos ?? null, im.taxasVendas ?? null);
  add("contribuicao", "(=) Margem de contribuição", u("contribuicao"), acrescimo, "subtotal");
  add("pessoal", "(−) Pessoal (CMO)", u("pessoal"), 0, "linha", "A folha do RH já inclui quem trabalha na marmitaria.");
  add("fixas", "(−) Despesas fixas, pró-labore e financeiras", somar(somar(u("fixas"), u("pro_labore", true)), u("financeiro", true)), 0, "linha",
    "As contas da marmitaria e as compartilhadas já estão nas despesas da unidade.");
  const resultado = add("resultado", "(=) Resultado consolidado", u("resultado"), acrescimo, "resultado");
  return { linhas, receita, tributos, receitaLiquida: rl, cmv, variaveis, resultado };
}

function agruparValor(xs, chave) {
  const m = new Map();
  for (const x of xs) { const k = chave(x); m.set(k, (m.get(k) || 0) + parseNumero(x.valorMarmitaria)); }
  return [...m.entries()].map(([k, v]) => [k, r2(v)]).sort((a, b) => b[1] - a[1]);
}

// ─── Simulador ───────────────────────────────────────────────────────────────

export const CENARIOS_PADRAO = [30, 50, 80, 100, 150];

/**
 * mix:   [{ nome, participacao (%), preco, custo, canal }] — participações somam 100
 * Retorna o resultado unitário médio e cada cenário. Natureza: SIMULAÇÃO.
 */
export function simular({ cenarios = CENARIOS_PADRAO, diasMes = 26, mix = [], canais = new Map(), tributosPct = null, cmoMes = 0, despesasMes = 0, margemDesejadaPct = null } = {}) {
  const dias = pos(diasMes);
  const avisos = [];
  const totalPart = soma(mix, (m) => pos(m.participacao));
  if (!mix.length) return { valido: false, motivo: "Monte o mix: escolha as marmitas e a participação de cada uma." };
  if (Math.abs(totalPart - 100) > 0.01) return { valido: false, motivo: `As participações somam ${r2(totalPart)}%: ajuste para 100%.` };
  if (!(dias > 0)) return { valido: false, motivo: "Informe os dias trabalhados no mês." };
  let rec = 0, trib = 0, taxas = 0, custo = 0, mc = 0, preco = 0;
  for (const m of mix) {
    const w = pos(m.participacao) / 100;
    const r = resultadoPorCanal({ preco: m.preco, custoTecnico: m.custo, canal: canais.get(m.canal) || { id: m.canal, nome: m.canal }, tributosPct });
    if (!r.valido) return { valido: false, motivo: `${m.nome}: ${r.motivo}` };
    if (r.margemContribuicao === null) return { valido: false, motivo: `${m.nome}: sem custo técnico.` };
    avisos.push(...r.avisos);
    preco += w * r.preco; rec += w * r.receita; trib += w * r.tributos; taxas += w * r.variaveis; custo += w * r.custo; mc += w * r.margemContribuicao;
  }
  const fixos = pos(cmoMes) + pos(despesasMes);
  const m = margemDesejadaPct === null || margemDesejadaPct === "" ? null : parseNumero(margemDesejadaPct) / 100;
  const linha = (porDia) => {
    const total = porDia * dias;
    const faturamento = total * rec;
    const lucro = total * mc - fixos;
    return {
      porDia, total, faturamentoDia: r2(porDia * rec), faturamento: r2(faturamento), cmv: r2(total * custo),
      tributos: r2(total * trib), taxas: r2(total * taxas), margemContribuicao: r2(total * mc),
      cmo: r2(pos(cmoMes)), despesas: r2(pos(despesasMes)), lucro: r2(lucro),
      margemLiquidaPct: faturamento > 0 ? r2((lucro / faturamento) * 100) : null,
    };
  };
  const peMes = mc > 0 ? fixos / mc : null;
  let metaMes = null; let motivoMeta = null;
  if (m === null) motivoMeta = "Informe a margem de lucro desejada.";
  else if (!(mc - m * rec > 0)) motivoMeta = "Com esse preço e esses custos a margem desejada não é alcançável em volume nenhum.";
  else metaMes = fixos / (mc - m * rec);
  return {
    valido: true, natureza: "simulacao", avisos: [...new Set(avisos)],
    unitario: { preco: r2(preco), receita: r2(rec), tributos: r2(trib), taxas: r2(taxas), custo: r2(custo), margemContribuicao: r2(mc),
      margemContribuicaoPct: rec > 0 ? r2((mc / rec) * 100) : null },
    fixosMes: r2(fixos),
    cenarios: cenarios.map((n) => linha(pos(n))),
    pontoEquilibrio: peMes === null ? null : { marmitasMes: Math.ceil(peMes), marmitasDia: Math.ceil(peMes / dias), faturamentoMes: r2(peMes * rec) },
    motivoPontoEquilibrio: peMes === null ? "Margem de contribuição por marmita é zero ou negativa." : null,
    meta: metaMes === null ? null : { marmitasMes: Math.ceil(metaMes), marmitasDia: Math.ceil(metaMes / dias) },
    motivoMeta,
  };
}

// ─── Período dos filtros ─────────────────────────────────────────────────────

export function periodo(tipo, hojeIso, personalizado = {}) {
  const hoje = String(hojeIso).slice(0, 10);
  if (tipo === "hoje") return { de: hoje, ate: hoje };
  if (tipo === "semana") {
    const d = new Date(`${hoje}T12:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
    return { de: somarDiasIso(hoje, -dow), ate: hoje };
  }
  if (tipo === "personalizado") {
    const de = String(personalizado.de || "").slice(0, 10) || hoje;
    const ate = String(personalizado.ate || "").slice(0, 10) || hoje;
    return de <= ate ? { de, ate } : { de: ate, ate: de };
  }
  return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
}

/**
 * Visão da EMPRESA com negócios em unidades próprias (restaurante, eventos,
 * marmitaria…): uma coluna por unidade + total. Nada é contado duas vezes:
 *   - unidades comuns: DRE gerencial do Financeiro (dre-gerencial.mjs);
 *   - marmitaria: o DRE dela, MENOS o CMO de pessoas cedidas por outra
 *     unidade (o salário já está no RH da origem);
 *   - transferências entre unidades já se anulam no CMV de cada unidade
 *     (saída não é consumo da origem; entrada é compra do destino).
 * Valor de uma coluna sem dado = null, e o total da linha também fica null.
 */
export function dreEmpresa({ unidades = [], marmitaria = null } = {}) {
  const colunas = [];
  for (const u of unidades) {
    const v = (id, ausenteZero = false) => { const l = u.dre?.linhas?.find((x) => x.id === id); return l ? l.valor : ausenteZero ? 0 : null; };
    const somaN = (...xs) => (xs.some((x) => x === null || x === undefined) ? null : r2(soma(xs)));
    colunas.push({ id: u.id, nome: u.nome, tipo: "unidade", valores: {
      receita: v("faturamento"), tributos: v("impostos"), cmv: v("cmv"), variaveis: v("variaveis"), pessoal: v("pessoal"),
      fixas: somaN(v("fixas"), v("pro_labore", true), v("financeiro", true)), resultado: v("resultado"),
    } });
  }
  if (marmitaria?.dre) {
    const i = marmitaria.dre.indicadores || {};
    const ced = pos(marmitaria.cmoCedido);
    const sub = (a, b) => (a === null || a === undefined || b === null || b === undefined ? null : r2(a - b));
    const variaveis = sub(i.lucroBruto, i.margemContribuicao);
    const cmo = i.cmo ?? 0;
    const operacionais = sub(i.margemContribuicao, i.resultadoOperacional);
    const financeiro = sub(i.resultadoOperacional, i.lucroLiquido);
    colunas.push({ id: marmitaria.id, nome: marmitaria.nome, tipo: "marmitaria", cedido: r2(ced), valores: {
      receita: i.receita ?? null, tributos: i.tributos ?? null, cmv: i.cmv ?? null, variaveis,
      pessoal: r2(cmo - ced),
      fixas: operacionais === null || financeiro === null ? null : r2(operacionais - cmo + financeiro),
      resultado: i.lucroLiquido === null || i.lucroLiquido === undefined ? null : r2(i.lucroLiquido + ced),
    } });
  }
  const LINHAS = [
    ["receita", "Receita de vendas", "subtotal"], ["tributos", "(−) Tributos sobre vendas"], ["cmv", "(−) CMV"],
    ["variaveis", "(−) Custos variáveis (taxas, comissões)"], ["pessoal", "(−) Pessoal (CMO)"],
    ["fixas", "(−) Despesas fixas, pró-labore e financeiras"], ["resultado", "(=) Resultado", "resultado"],
  ];
  const linhas = LINHAS.map(([id, rotulo, tipo = "linha"]) => {
    const valores = colunas.map((c) => c.valores[id]);
    return { id, rotulo, tipo, valores, total: !colunas.length || valores.some((x) => x === null || x === undefined) ? null : r2(soma(valores)) };
  });
  return { colunas: colunas.map(({ id, nome, tipo, cedido }) => ({ id, nome, tipo, cedido })), linhas };
}
