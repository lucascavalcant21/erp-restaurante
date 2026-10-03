// Orçamento do evento, em etapas: tipo → cardápio → equipe → aluguel e extras
// → cliente → custos financeiros e preço → DRE → orçamento para o cliente.
// FONTE ÚNICA das contas do orçamento. Funções puras (testes em
// evento-orcamento.test.mjs).
//
// O orçamento mora em `eventos.operacao_detalhes.orcamento` (coluna JSON que
// já existe): nada muda no banco. As fichas exclusivas do evento ficam só
// aqui dentro — não entram nas fichas técnicas do restaurante. O DRE do
// evento é só dele: não lê nem escreve nada do DRE da casa.

import { custoPorcaoDaFicha, listaDeComprasDeFichas } from "./evento-financeiro.mjs";
import { parseNumero } from "./ficha-calculos.mjs";
import { arred2, percentualDe } from "./valor-percentual.mjs";

const pos = (v) => Math.max(0, parseNumero(v));
const r2 = (v) => arred2(Number(v) || 0);
const novoId = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ─── Catálogos ──────────────────────────────────────────────────────────────

export const SECOES = {
  buffet: { id: "buffet", rotulo: "Buffet", setor: "cozinha" },
  entrada: { id: "entrada", rotulo: "Entrada", setor: "cozinha" },
  principal: { id: "principal", rotulo: "Prato principal", setor: "cozinha" },
  sobremesa: { id: "sobremesa", rotulo: "Sobremesa", setor: "cozinha" },
  bar: { id: "bar", rotulo: "Bar e drinks", setor: "bar" },
  unico: { id: "unico", rotulo: "Item do evento", setor: null },
};

export const TIPOS_EVENTO = [
  { id: "buffet", rotulo: "Buffet", ajuda: "Vários pratos servidos à vontade. Você diz quanto cada convidado come de cada um.", secoes: ["buffet", "bar"] },
  { id: "alacarte", rotulo: "À la carte", ajuda: "Menu em etapas: entrada, prato principal, sobremesa e bar. Deixe vazia a etapa que não tiver.", secoes: ["entrada", "principal", "sobremesa", "bar"] },
  { id: "unico", rotulo: "Uma coisa só", ajuda: "O evento tem um item só (só o coquetel, só o bar, só um prato).", secoes: ["unico"] },
];
export const tipoDoEvento = (id) => TIPOS_EVENTO.find((t) => t.id === id) || TIPOS_EVENTO[0];

export const AREAS_EQUIPE = ["Cozinha", "Bar", "Salão", "Recepção", "Limpeza", "Coordenação", "Segurança", "Outros"];
// Áreas da equipe antiga (tabela evento_equipe: cozinha, bar, salao).
const AREA_LEGADA = { cozinha: "Cozinha", bar: "Bar", salao: "Salão" };

export const CATEGORIAS_EXTRAS = [
  { id: "aluguel", rotulo: "Aluguel" },
  { id: "decoracao", rotulo: "Decoração" },
  { id: "musica", rotulo: "Música" },
  { id: "outros", rotulo: "Outros" },
];

export const FORMAS_PAGAMENTO = ["PIX", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência", "Boleto"];

// Unidades da ficha exclusiva. Embalagem e uso podem ser diferentes (compra
// em kg, usa em g): a conta converte para a base (g, ml, un).
export const UNIDADES = ["g", "kg", "ml", "L", "un"];
const BASE = { g: ["g", 1], kg: ["g", 1000], ml: ["ml", 1], l: ["ml", 1000], un: ["un", 1] };
function paraBase(q, unidade) {
  const b = BASE[String(unidade || "").toLowerCase()];
  return b ? { q: pos(q) * b[1], base: b[0] } : { q: pos(q), base: String(unidade || "") };
}

// ─── Orçamento: vazio, migração e normalização ──────────────────────────────

export function orcamentoVazio(params = {}) {
  return {
    versao: 1,
    tipo: "buffet",
    cardapio: [],
    equipe: [],
    extras: [],
    obs_equipe: "",
    // Sobra de segurança: % a mais de comida e bebida sobre o consumo previsto.
    sobra_pct: 0,
    cliente: {
      nome_evento: "", cliente_nome: "", cliente_telefone: "", cliente_id: null, data_evento: "", convidados: 0, criancas: 0,
      local_evento: "", hora_inicio: "", hora_fim: "", forma_pagamento: "", observacoes: "",
    },
    financeiro: {
      imposto_pct: pos(params.imposto_pct),
      maquininha_pct: pos(params.taxa_cartao_pct),
      meta_lucro_pct: pos(params.margem_alvo_pct),
      prolabore: { modo: "pct", valor: 0 },
      comissoes: [],
      preco_por_pessoa: 0,
      // Criança: paga % do adulto (ou um valor fixo) e come uma fração de um adulto.
      preco_crianca: { modo: "pct", valor: 50 },
      consumo_crianca_pct: 50,
      desconto: { modo: "valor", valor: 0 },
    },
    proposta: { validade_dias: 15, condicoes: "" },
    // Depois do evento: o que foi gasto de verdade (orçado × realizado).
    realizado: {},
  };
}

// Mescla o orçamento salvo sobre o vazio, um nível abaixo nos objetos.
function mesclar(base, salvo) {
  const fin = salvo.financeiro || {};
  return {
    ...base, ...salvo,
    cardapio: Array.isArray(salvo.cardapio) ? salvo.cardapio : [],
    equipe: Array.isArray(salvo.equipe) ? salvo.equipe : [],
    extras: Array.isArray(salvo.extras) ? salvo.extras : [],
    cliente: { ...base.cliente, ...(salvo.cliente || {}) },
    financeiro: {
      ...base.financeiro, ...fin,
      prolabore: { ...base.financeiro.prolabore, ...(fin.prolabore || {}) },
      preco_crianca: { ...base.financeiro.preco_crianca, ...(fin.preco_crianca || {}) },
      desconto: { ...base.financeiro.desconto, ...(fin.desconto || {}) },
      comissoes: Array.isArray(fin.comissoes) ? fin.comissoes : [],
    },
    proposta: { ...base.proposta, ...(salvo.proposta || {}) },
    realizado: { ...(salvo.realizado || {}) },
  };
}

const temValor = (v) => v !== null && v !== undefined && v !== "";

/* O orçamento do evento. Se ainda não existe (evento criado antes desta
 * versão), nasce do que o evento já tinha: pratos de cardapio_itens, equipe da
 * tabela evento_equipe, aluguel do espaço, taxas e valor contratado — nada que
 * estava lançado se perde.
 */
export function orcamentoDoEvento(evento = {}, params = {}, equipeLegada = []) {
  const base = orcamentoVazio(params);
  const salvo = evento?.operacao_detalhes?.orcamento;
  const convidados = pos(evento.capacidade);
  const clienteDoEvento = {
    nome_evento: evento.nome || "", cliente_nome: evento.cliente_nome || "", cliente_telefone: evento.cliente_telefone || "",
    data_evento: String(evento.data_evento || "").slice(0, 10), convidados,
    local_evento: evento.local_evento || "", hora_inicio: String(evento.hora_inicio || "").slice(0, 5), hora_fim: String(evento.hora_fim || "").slice(0, 5),
  };
  if (salvo && typeof salvo === "object") {
    const o = mesclar(base, salvo);
    // As colunas do evento mandam nos dados do cliente (o funil e a agenda
    // também editam nome, data e convidados).
    o.cliente = { ...o.cliente, ...Object.fromEntries(Object.entries(clienteDoEvento).filter(([, v]) => temValor(v) && v !== 0)) };
    return o;
  }
  // Migração do formato antigo.
  const itens = Array.isArray(evento.cardapio_itens) ? evento.cardapio_itens : [];
  const temBar = itens.some((i) => i.departamento === "bar");
  return {
    ...base,
    tipo: "buffet",
    cardapio: itens.map((i) => ({
      id: i.id || novoId(), secao: i.departamento === "bar" && temBar ? "bar" : "buffet", origem: "ficha",
      ficha_id: i.ficha_id || null, nome: i.nome || "Prato", descricao: "",
      por_pessoa: convidados > 0 && pos(i.quantidade_servida) > 0 ? Math.round((pos(i.quantidade_servida) / convidados) * 100) / 100 : 1,
      custo_porcao_gravado: pos(i.custo_porcao ?? i.custo_unidade),
    })),
    equipe: (equipeLegada || []).map((p) => ({
      id: p.id || novoId(), area: AREA_LEGADA[String(p.area || "").toLowerCase()] || "Outros",
      funcao: p.funcao || "", nome: p.nome || "", quantidade: 1, valor: pos(p.custo),
    })),
    extras: pos(evento.custo_aluguel_espaco) > 0 ? [{ id: novoId(), categoria: "aluguel", descricao: "Espaço", valor: pos(evento.custo_aluguel_espaco) }] : [],
    cliente: { ...base.cliente, ...clienteDoEvento },
    financeiro: {
      ...base.financeiro,
      imposto_pct: temValor(evento.taxa_imposto_pct) ? pos(evento.taxa_imposto_pct) : base.financeiro.imposto_pct,
      maquininha_pct: temValor(evento.taxa_maquininha_pct) ? pos(evento.taxa_maquininha_pct) : base.financeiro.maquininha_pct,
      preco_por_pessoa: convidados > 0 && pos(evento.valor_contratado) > 0 ? r2(pos(evento.valor_contratado) / convidados) : 0,
    },
  };
}

// ─── Ficha exclusiva do evento ──────────────────────────────────────────────

export function ingredienteVazio() {
  return { id: novoId(), nome: "", preco_embalagem: "", tamanho_embalagem: "", unidade_embalagem: "kg", quantidade: "", unidade_uso: "g", aproveitamento_pct: 100 };
}

/* Custo de UMA porção da ficha exclusiva. Cada ingrediente:
 *   preço da embalagem ÷ tamanho da embalagem × quantidade usada na porção
 *   ÷ aproveitamento (100% = sem perda; 80% = perde 20% limpando)
 * Embalagem e uso em unidades da mesma família (kg × g, L × ml).
 */
export function custoDaFichaExclusiva(ingredientes = []) {
  const linhas = (ingredientes || []).map((ing) => {
    const emb = paraBase(ing.tamanho_embalagem, ing.unidade_embalagem);
    const uso = paraBase(ing.quantidade, ing.unidade_uso);
    const aprov = pos(ing.aproveitamento_pct) || 100;
    const compativel = emb.base === uso.base;
    const completo = pos(ing.preco_embalagem) > 0 && emb.q > 0 && uso.q > 0;
    const custo = compativel && completo ? (pos(ing.preco_embalagem) / emb.q) * uso.q / (Math.min(aprov, 100) / 100) : 0;
    return { id: ing.id, nome: ing.nome || "Ingrediente", custo, compativel, completo };
  });
  return {
    custoPorcao: linhas.reduce((t, l) => t + l.custo, 0),
    linhas,
    problemas: linhas.filter((l) => !l.compativel || !l.completo).map((l) => (!l.compativel ? `${l.nome}: unidade da embalagem e do uso não combinam` : `${l.nome}: falta preço, embalagem ou quantidade`)),
  };
}

// ─── Cardápio ───────────────────────────────────────────────────────────────

// Seções que valem para o tipo escolhido; item em seção de outro tipo (o dono
// trocou de buffet para à la carte) cai na primeira seção do tipo novo.
export function secaoDoItem(item, tipo) {
  const secoes = tipoDoEvento(tipo).secoes;
  return secoes.includes(item.secao) ? item.secao : (item.secao === "bar" && secoes.includes("bar") ? "bar" : secoes[0]);
}

/* Cada produto com o custo de UMA porção e o custo POR PESSOA:
 *   ficha do sistema → custo atual da ficha técnica (perda, porções, subfichas)
 *   ficha exclusiva  → ingredientes cadastrados no evento
 *   custo por pessoa = custo da porção × porções por pessoa
 * "Porções por pessoa": 1 no à la carte; no buffet, fração (0,5 = meia porção
 * por convidado); dois pratos principais à escolha = 0,5 cada.
 * No buffet dá para informar em GRAMAS por pessoa (medida "g"): porções por
 * pessoa = gramas ÷ peso da porção (da ficha técnica, ou o informado na ficha
 * exclusiva).
 */
export function itensDoOrcamento(orc = {}, fichas = []) {
  const porId = new Map((fichas || []).map((f) => [f.id, f]));
  return (orc.cardapio || []).map((item) => {
    const secao = secaoDoItem(item, orc.tipo);
    let custoPorcao = 0; let aoVivo = false; let problemas = [];
    let ficha = null;
    if (item.origem === "exclusiva") {
      const c = custoDaFichaExclusiva(item.ingredientes);
      custoPorcao = c.custoPorcao; problemas = c.problemas; aoVivo = true;
    } else {
      ficha = porId.get(item.ficha_id) || null;
      if (ficha) { custoPorcao = custoPorcaoDaFicha(ficha, fichas) || 0; aoVivo = true; }
      else { custoPorcao = pos(item.custo_porcao_gravado); problemas = ["ficha removida: custo congelado"]; }
    }
    const pesoPorcao = item.origem === "exclusiva" ? pos(item.peso_porcao_g) : pos(ficha?.peso_porcao_g);
    const emGramas = item.medida === "g" && secao !== "bar";
    let porPessoa = pos(item.por_pessoa);
    if (emGramas) {
      porPessoa = pesoPorcao > 0 ? pos(item.gramas_por_pessoa) / pesoPorcao : 0;
      if (!(pesoPorcao > 0)) problemas = [...problemas, item.origem === "exclusiva" ? "informe o peso da porção para usar gramas" : "a ficha não tem peso da porção; use porções"];
    }
    return { ...item, secao, ficha, emGramas, pesoPorcao, porPessoa, custoPorcao, custoPorPessoa: custoPorcao * porPessoa, aoVivo, problemas, semCusto: !(custoPorcao > 0) };
  });
}

// ─── Resumo: custo por pessoa, preço sugerido e DRE do evento ───────────────

const valorDaRegra = (regra, receita) => (regra?.modo === "valor" ? pos(regra.valor) : receita * pos(regra?.valor) / 100);

// Custo de uma linha da equipe: quantidade × (diária, ou horas × valor da hora).
export function custoDaPessoa(p = {}) {
  const qtd = p.quantidade === "" || p.quantidade === undefined || p.quantidade === null ? 1 : pos(p.quantidade);
  return qtd * (p.modo === "hora" ? pos(p.horas) * pos(p.valor) : pos(p.valor));
}

/* Contas do orçamento:
 *   Pessoas ........ adultos + crianças; a criança come consumo_crianca_pct de
 *                    um adulto e paga % do adulto (ou um valor fixo)
 *   Receita ........ adultos × preço + crianças × preço da criança − desconto
 *   CMV ............ Σ custo por pessoa × pessoas-equivalentes × (1 + sobra%)
 *   Equipe ......... Σ quantidade × diária (ou horas × valor da hora)
 *   Extras ......... aluguel, decoração, música, outros
 *   Imposto, maquininha, comissões em %, pró-labore em % → sobre a receita
 *   Comissões e pró-labore em R$ → valor fixo
 *   Lucro limpo = receita − tudo acima
 * Preço sugerido (do adulto) = o que faz a receita cobrir os custos fixos e
 * ainda deixar a meta: receita = fixos ÷ (1 − Σ% − meta%), desfazendo desconto e
 * crianças. Preço mínimo = o mesmo com meta 0 (lucro limpo zero).
 */
export function resumoDoOrcamento(orc = {}, fichas = [], { convidados: conv } = {}) {
  const convidados = pos(conv ?? orc?.cliente?.convidados);
  const criancas = Math.min(pos(orc?.cliente?.criancas), convidados);
  const adultos = convidados - criancas;
  const fin = orc.financeiro || {};
  const consumoCrianca = temValor(fin.consumo_crianca_pct) ? pos(fin.consumo_crianca_pct) / 100 : 0.5;
  const pessoasConsumo = adultos + criancas * consumoCrianca;
  const fatorSobra = 1 + pos(orc.sobra_pct) / 100;
  const itens = itensDoOrcamento(orc, fichas);
  const cmvPorPessoa = itens.reduce((t, i) => t + i.custoPorPessoa, 0);
  const cmvBebidaPP = itens.filter((i) => i.secao === "bar").reduce((t, i) => t + i.custoPorPessoa, 0);
  const cmvComida = r2((cmvPorPessoa - cmvBebidaPP) * pessoasConsumo * fatorSobra);
  const cmvBebida = r2(cmvBebidaPP * pessoasConsumo * fatorSobra);
  const cmv = r2(cmvComida + cmvBebida);

  const equipe = r2((orc.equipe || []).reduce((t, p) => t + custoDaPessoa(p), 0));
  const pessoasEquipe = (orc.equipe || []).reduce((t, p) => t + (p.quantidade === "" || p.quantidade === undefined ? 1 : pos(p.quantidade)), 0);
  const extrasPorCategoria = CATEGORIAS_EXTRAS.map((c) => ({ ...c, valor: r2((orc.extras || []).filter((x) => (x.categoria || "outros") === c.id).reduce((t, x) => t + pos(x.valor), 0)) }));
  const extras = r2(extrasPorCategoria.reduce((t, c) => t + c.valor, 0));

  const precoPorPessoa = pos(fin.preco_por_pessoa);
  const pc = fin.preco_crianca || { modo: "pct", valor: 50 };
  const precoCrianca = r2(pc.modo === "valor" ? pos(pc.valor) : precoPorPessoa * pos(pc.valor) / 100);
  const receitaBruta = r2(precoPorPessoa * adultos + precoCrianca * criancas);
  const desconto = r2(Math.min(receitaBruta, fin.desconto?.modo === "pct" ? receitaBruta * pos(fin.desconto?.valor) / 100 : pos(fin.desconto?.valor)));
  const receita = r2(receitaBruta - desconto);
  const impostoPct = pos(fin.imposto_pct);
  const maquininhaPct = pos(fin.maquininha_pct);
  const imposto = r2(receita * impostoPct / 100);
  const maquininha = r2(receita * maquininhaPct / 100);
  const comissoes = (fin.comissoes || []).map((c) => ({ ...c, total: r2(valorDaRegra(c, receita)) }));
  const comissoesTotal = r2(comissoes.reduce((t, c) => t + c.total, 0));
  const prolabore = r2(valorDaRegra(fin.prolabore, receita));

  const receitaLiquida = r2(receita - imposto - maquininha);
  const lucroBruto = r2(receitaLiquida - cmv);
  const antesProlabore = r2(lucroBruto - equipe - extras - comissoesTotal);
  const lucro = r2(antesProlabore - prolabore);

  // Preço sugerido: o que não depende do preço ÷ o que sobra depois das %.
  const regras = [...(fin.comissoes || []), fin.prolabore].filter(Boolean);
  const fixos = cmv + equipe + extras + regras.filter((g) => g.modo === "valor").reduce((t, g) => t + pos(g.valor), 0);
  const pctSobrePreco = impostoPct + maquininhaPct + regras.filter((g) => g.modo !== "valor").reduce((t, g) => t + pos(g.valor), 0);
  const metaPct = pos(fin.meta_lucro_pct);
  const precoPara = (meta) => {
    const sobra = 100 - pctSobrePreco - meta;
    if (!(convidados > 0) || !(fixos > 0) || !(sobra > 0)) return null;
    const receitaAlvo = fixos / (sobra / 100);
    const descPct = fin.desconto?.modo === "pct" ? Math.min(pos(fin.desconto?.valor), 99.99) / 100 : 0;
    const bruta = descPct ? receitaAlvo / (1 - descPct) : receitaAlvo + (fin.desconto?.modo === "pct" ? 0 : pos(fin.desconto?.valor));
    const fixoCriancas = pc.modo === "valor" ? pos(pc.valor) * criancas : 0;
    const pesoAdulto = adultos + (pc.modo === "valor" ? 0 : criancas * pos(pc.valor) / 100);
    if (!(pesoAdulto > 0)) return null;
    const p = (bruta - fixoCriancas) / pesoAdulto;
    return p > 0 ? Math.ceil(p * 100) / 100 : null; // arredonda para cima: nunca abaixo da meta
  };

  const pct = (v) => percentualDe(v, receita);
  const L = (id, rotulo, valor, tipo = "custo", extra = {}) => ({ id, rotulo, valor, pct: pct(valor), porPessoa: convidados > 0 ? r2(valor / convidados) : null, tipo, ...extra });
  const dre = [
    ...(desconto > 0 ? [L("receita_bruta", "Receita bruta", receitaBruta, "receita"), L("desconto", "(−) Desconto", desconto)] : []),
    L("receita", "Receita do evento", receita, "receita"),
    L("imposto", `(−) Impostos (${impostoPct.toLocaleString("pt-BR")}%)`, imposto),
    L("maquininha", `(−) Taxa da maquininha (${maquininhaPct.toLocaleString("pt-BR")}%)`, maquininha),
    L("receita_liquida", "(=) Receita líquida", receitaLiquida, "subtotal"),
    L("cmv_comida", "(−) Comida (CMV)", cmvComida),
    L("cmv_bebida", "(−) Bebidas (CMV)", cmvBebida),
    L("lucro_bruto", "(=) Lucro bruto", lucroBruto, "subtotal"),
    L("equipe", `(−) Equipe${pessoasEquipe ? ` (${pessoasEquipe.toLocaleString("pt-BR")} pessoas)` : ""}`, equipe),
    ...extrasPorCategoria.filter((c) => c.valor > 0).map((c) => L(`extra_${c.id}`, `(−) ${c.rotulo}`, c.valor)),
    ...comissoes.filter((c) => c.total > 0).map((c) => L(`comissao_${c.id}`, `(−) Comissão${c.nome ? `: ${c.nome}` : ""}${c.modo !== "valor" ? ` (${pos(c.valor).toLocaleString("pt-BR")}%)` : ""}`, c.total)),
    L("antes_prolabore", "(=) Resultado antes do pró-labore", antesProlabore, "subtotal"),
    L("prolabore", `(−) Pró-labore${fin.prolabore?.modo !== "valor" && prolabore > 0 ? ` (${pos(fin.prolabore?.valor).toLocaleString("pt-BR")}%)` : ""}`, prolabore),
    L("lucro", "(=) Lucro limpo", lucro, "resultado"),
  ];

  const custoTotal = r2(receita - lucro); // tudo o que sai, incluindo taxas e pró-labore
  return {
    convidados, adultos, criancas, pessoasConsumo, sobraPct: pos(orc.sobra_pct), itens, dre,
    precoCrianca, receitaBruta, desconto,
    precoMedioPorPessoa: convidados > 0 && receita > 0 ? r2(receita / convidados) : null,
    cmv, cmvComida, cmvBebida, equipe, pessoasEquipe, extras, extrasPorCategoria,
    imposto, maquininha, comissoes, comissoesTotal, prolabore,
    receita, receitaLiquida, lucroBruto, lucro,
    lucroPct: pct(lucro),
    precoPorPessoa,
    cmvPorPessoa: r2(cmvPorPessoa),
    // Custo por pessoa da operação (cardápio + equipe + extras), antes de taxas.
    custoOperacaoPorPessoa: convidados > 0 ? r2((cmv + equipe + extras) / convidados) : null,
    custoTotalPorPessoa: convidados > 0 && receita > 0 ? r2(custoTotal / convidados) : null,
    lucroPorPessoa: convidados > 0 && receita > 0 ? r2(lucro / convidados) : null,
    meta: { pct: metaPct, atingida: receita > 0 && (pct(lucro) ?? -Infinity) >= metaPct - 0.005 },
    precoSugeridoPorPessoa: precoPara(metaPct),
    // Sugerido arredondado para o próximo real inteiro (preço "redondo").
    precoSugeridoRedondo: precoPara(metaPct) ? Math.ceil(precoPara(metaPct) - 0.000001) : null,
    precoMinimoPorPessoa: precoPara(0),
    prejuizo: receita > 0 && lucro < 0,
    semCusto: itens.filter((i) => i.semCusto).map((i) => i.nome),
  };
}

// ─── Orçado × realizado ─────────────────────────────────────────────────────

export const LINHAS_REALIZADO = [
  { id: "receita", rotulo: "Receita", receita: true },
  { id: "cmv_comida", rotulo: "Comida (CMV)" },
  { id: "cmv_bebida", rotulo: "Bebidas (CMV)" },
  { id: "equipe", rotulo: "Equipe" },
  { id: "extras", rotulo: "Aluguel e extras" },
  { id: "imposto", rotulo: "Impostos" },
  { id: "maquininha", rotulo: "Maquininha" },
  { id: "comissoes", rotulo: "Comissões" },
  { id: "prolabore", rotulo: "Pró-labore" },
];

/* Depois do evento, o dono lança o que foi gasto de verdade. Linha em branco
 * fica com o valor orçado (marcada como não lançada). O recebido nos
 * pagamentos vai junto só como referência: pagamento parcial não é receita
 * menor.
 */
export function realizadoDoEvento(orc = {}, r, { recebido = 0 } = {}) {
  const orcado = {
    receita: r.receita, cmv_comida: r.cmvComida, cmv_bebida: r.cmvBebida, equipe: r.equipe, extras: r.extras,
    imposto: r.imposto, maquininha: r.maquininha, comissoes: r.comissoesTotal, prolabore: r.prolabore,
  };
  const real = orc.realizado || {};
  const linhas = LINHAS_REALIZADO.map((l) => {
    const lancado = temValor(real[l.id]);
    const valor = lancado ? r2(pos(real[l.id])) : orcado[l.id];
    const origem = lancado ? "lancado" : "orcado";
    return { ...l, orcado: orcado[l.id], real: valor, origem, diferenca: r2(valor - orcado[l.id]) };
  });
  const receitaReal = linhas[0].real;
  const custosReais = r2(linhas.slice(1).reduce((t, l) => t + l.real, 0));
  const lucroReal = r2(receitaReal - custosReais);
  return {
    linhas,
    lucroOrcado: r.lucro,
    lucroReal,
    lucroRealPct: percentualDe(lucroReal, receitaReal),
    diferencaLucro: r2(lucroReal - r.lucro),
    lancadas: linhas.filter((l) => l.origem === "lancado").length,
    recebido: r2(recebido),
  };
}

// ─── Cliente, equipe e funil ────────────────────────────────────────────────

const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const normNome = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Outros eventos do mesmo cliente (pelo telefone, ou pelo nome quando não há).
export function historicoDoCliente(eventos = [], cliente = {}, idAtual = null) {
  const fone = soDigitos(cliente.cliente_telefone).slice(-8);
  const nome = normNome(cliente.cliente_nome);
  if (!fone && !nome) return [];
  return (eventos || [])
    .filter((e) => e.id !== idAtual)
    .filter((e) => (fone && soDigitos(e.cliente_telefone).slice(-8) === fone) || (!fone && nome && normNome(e.cliente_nome) === nome))
    .map((e) => ({ id: e.id, nome: e.nome, data: String(e.data_evento || "").slice(0, 10), valor: pos(e.valor_contratado), pessoas: pos(e.capacidade), etapa: e.funil_status }))
    .sort((a, b) => b.data.localeCompare(a.data));
}

// Nomes da equipe que já estão em outro evento na mesma data.
export function conflitosDeEquipe(orc = {}, outrosEventos = []) {
  const data = orc?.cliente?.data_evento;
  if (!data) return [];
  const nomes = new Map((orc.equipe || []).filter((p) => normNome(p.nome)).map((p) => [normNome(p.nome), p.nome]));
  const conflitos = [];
  for (const e of outrosEventos || []) {
    if (String(e.data_evento || "").slice(0, 10) !== data) continue;
    for (const p of e.operacao_detalhes?.orcamento?.equipe || []) {
      const k = normNome(p.nome);
      if (k && nomes.has(k)) conflitos.push({ nome: nomes.get(k), evento: e.nome || e.cliente_nome || "outro evento", eventoId: e.id });
    }
  }
  return conflitos;
}

// Pessoas que já trabalharam em eventos, com a área, função e valor da última vez.
export function sugestoesDeEquipe(eventos = []) {
  const porNome = new Map();
  const ordenados = [...(eventos || [])].sort((a, b) => String(a.data_evento || "").localeCompare(String(b.data_evento || "")));
  for (const e of ordenados) {
    for (const p of e.operacao_detalhes?.orcamento?.equipe || []) {
      const k = normNome(p.nome);
      if (k) porNome.set(k, { nome: String(p.nome).trim(), area: p.area, funcao: p.funcao || "", modo: p.modo || "diaria", valor: p.valor, horas: p.horas || "" });
    }
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Etapas que contam como evento fechado e como proposta feita.
const FECHADO = ["APROVADO", "AGUARDANDO SINAL", "SINAL PAGO", "CONFIRMADO", "PREPARACAO", "EM PRODUCAO", "EVENTO", "FINALIZADO"];
const PROPOSTA = ["PROPOSTA ENVIADA", "NEGOCIACAO", ...FECHADO, "CANCELADO"];
const semAcentoMaiusc = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

/* Números do funil no mês (YYYY-MM, pela data do evento; "" = todos):
 * eventos, fechados, valor e lucro previsto dos fechados, ticket médio e
 * conversão (fechados ÷ propostas enviadas). O lucro vem do resumo gravado
 * pelo orçamento (operacao_detalhes.resumo).
 */
export function indicadoresDoFunil(eventos = [], mes = "") {
  const doMes = (eventos || []).filter((e) => !mes || String(e.data_evento || "").slice(0, 7) === mes);
  const etapa = (e) => semAcentoMaiusc(e.funil_status) || "NOVO CONTATO";
  const fechados = doMes.filter((e) => FECHADO.includes(etapa(e)));
  const propostas = doMes.filter((e) => PROPOSTA.includes(etapa(e)));
  const valor = r2(fechados.reduce((t, e) => t + pos(e.valor_contratado), 0));
  const comLucro = fechados.filter((e) => typeof e.operacao_detalhes?.resumo?.lucro === "number");
  return {
    eventos: doMes.filter((e) => etapa(e) !== "CANCELADO").length,
    fechados: fechados.length,
    valor,
    lucro: comLucro.length ? r2(comLucro.reduce((t, e) => t + e.operacao_detalhes.resumo.lucro, 0)) : null,
    lucroParcial: comLucro.length > 0 && comLucro.length < fechados.length,
    ticketMedio: fechados.length ? r2(valor / fechados.length) : null,
    conversao: propostas.length ? r2((fechados.length / propostas.length) * 100) : null,
  };
}

// ─── Modelos e cópia ────────────────────────────────────────────────────────

// Ids novos para tudo o que é lista (o modelo não pode compartilhar ids com o evento).
function comIdsNovos(orc) {
  const re = (l) => (l || []).map((x) => ({ ...x, id: novoId() }));
  return {
    ...orc,
    cardapio: (orc.cardapio || []).map((i) => ({ ...i, id: novoId(), ingredientes: i.ingredientes ? re(i.ingredientes) : i.ingredientes })),
    equipe: re(orc.equipe),
    extras: re(orc.extras),
    financeiro: { ...orc.financeiro, comissoes: re(orc.financeiro?.comissoes) },
  };
}

/* Modelo de orçamento ("Buffet casamento"): tipo, cardápio, equipe, extras,
 * taxas e preço — sem cliente, data, pessoas nem realizado.
 */
export function modeloDoOrcamento(orc, nome) {
  const { cliente, realizado, ...resto } = orc;
  return { id: novoId(), nome: String(nome || "").trim() || "Modelo sem nome", orcamento: comIdsNovos(resto) };
}

// Aplica o modelo mantendo os dados do cliente deste evento.
export function aplicarModelo(orc, modelo, params = {}) {
  const base = mesclar(orcamentoVazio(params), comIdsNovos(modelo.orcamento || {}));
  return { ...base, cliente: { ...orc.cliente }, realizado: { ...(orc.realizado || {}) } };
}

// Cópia de um evento para um novo: tudo, menos data, pagamentos e realizado.
export function copiaDoOrcamento(orc) {
  const c = comIdsNovos(orc);
  return { ...c, cliente: { ...orc.cliente, data_evento: "", nome_evento: orc.cliente?.nome_evento ? `Cópia de ${orc.cliente.nome_evento}` : "Cópia" }, realizado: {} };
}

// Resumo gravado junto do evento para o funil mostrar lucro sem recalcular.
export function resumoParaFunil(r) {
  return { receita: r.receita, lucro: r.lucro, lucro_pct: r.lucroPct, preco_por_pessoa: r.precoPorPessoa, custo_por_pessoa: r.custoTotalPorPessoa ?? r.custoOperacaoPorPessoa };
}

// ─── Pendências ─────────────────────────────────────────────────────────────

export function pendenciasDoOrcamento(orc = {}, r, { hojeIso, etapa, recebido = 0 } = {}) {
  const lista = [];
  const c = orc.cliente || {};
  if (!r.itens.length) lista.push("Cardápio não montado.");
  if (r.semCusto.length) lista.push(`Sem custo: ${r.semCusto.join(", ")}.`);
  for (const i of r.itens) for (const p of i.problemas) lista.push(`${i.nome}: ${p}.`);
  if (!(r.convidados > 0)) lista.push("Número de pessoas não informado.");
  if (!c.cliente_nome) lista.push("Nome do cliente não informado.");
  if (!c.data_evento) lista.push("Data do evento não definida.");
  if (!(r.precoPorPessoa > 0)) lista.push("Valor por pessoa não definido.");
  if (r.prejuizo) lista.push("O valor por pessoa não cobre os custos do evento.");
  else if (r.receita > 0 && !r.meta.atingida && r.meta.pct > 0) lista.push("O lucro limpo está abaixo da meta.");
  if (c.data_evento && hojeIso && c.data_evento < hojeIso && !["FINALIZADO", "CANCELADO"].includes(etapa)) lista.push("A data já passou e o evento não foi finalizado no funil.");
  const pendente = r2(r.receita - recebido);
  if (r.receita > 0 && pendente > 0.009 && ["CONFIRMADO", "PREPARACAO", "EM PRODUCAO", "EVENTO", "FINALIZADO"].includes(etapa)) {
    lista.push(`Falta receber R$ ${pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
  }
  return [...new Set(lista)];
}

// ─── Proposta para o cliente ────────────────────────────────────────────────

// Produtos agrupados pela seção, na ordem do tipo do evento. Só nome e
// descrição: custo nunca vai para o cliente.
export function cardapioParaCliente(orc = {}) {
  const tipo = tipoDoEvento(orc.tipo);
  return tipo.secoes
    .map((s) => ({ secao: s, rotulo: SECOES[s].rotulo, itens: (orc.cardapio || []).filter((i) => secaoDoItem(i, orc.tipo) === s).map((i) => ({ nome: i.nome, descricao: i.descricao || "" })) }))
    .filter((g) => g.itens.length);
}

const fmtR = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "a definir");

// Linhas de valor que o cliente vê: por pessoa, criança, desconto e total.
export function linhasDeValor(r) {
  const l = [`Valor por pessoa: ${fmtR(r.precoPorPessoa)}`];
  if (r.criancas > 0) l.push(`Crianças (${r.criancas}): ${fmtR(r.precoCrianca)} cada`);
  if (r.desconto > 0) l.push(`Desconto: −${fmtR(r.desconto)}`);
  if (r.convidados) l.push(`Total para ${r.convidados} pessoas: ${fmtR(r.receita)}`);
  return l;
}

// Texto do orçamento para o WhatsApp: produtos e valor por pessoa. Sem custos.
export function textoDoOrcamento(orc = {}, r, { casa = "" } = {}) {
  const c = orc.cliente || {};
  const linhas = [];
  linhas.push(`Olá${c.cliente_nome ? `, ${String(c.cliente_nome).split(" ")[0]}` : ""}! Segue o orçamento${c.nome_evento ? ` do evento *${c.nome_evento}*` : " do seu evento"}${casa ? ` — ${casa}` : ""}:`);
  const info = [
    `Data: ${fmtData(c.data_evento)}`,
    c.hora_inicio ? `Horário: ${c.hora_inicio}${c.hora_fim ? ` às ${c.hora_fim}` : ""}` : null,
    r.convidados ? `Pessoas: ${r.convidados}` : null,
    c.local_evento ? `Local: ${c.local_evento}` : null,
    `Serviço: ${tipoDoEvento(orc.tipo).rotulo}`,
  ].filter(Boolean);
  linhas.push(info.join("\n"));
  for (const g of cardapioParaCliente(orc)) linhas.push(`*${g.rotulo}*\n${g.itens.map((i) => `• ${i.nome}${i.descricao ? ` — ${i.descricao}` : ""}`).join("\n")}`);
  if (r.precoPorPessoa > 0) linhas.push(linhasDeValor(r).map((l, i) => (i === 0 ? `*${l}*` : l)).join("\n"));
  if (c.forma_pagamento) linhas.push(`Forma de pagamento: ${c.forma_pagamento}`);
  const val = pos(orc.proposta?.validade_dias);
  if (val > 0) linhas.push(`Orçamento válido por ${val} dias.`);
  if (orc.proposta?.condicoes) linhas.push(orc.proposta.condicoes);
  if (c.observacoes) linhas.push(c.observacoes);
  return linhas.join("\n\n");
}

export function linkWhatsApp(telefone, texto) {
  const fone = String(telefone || "").replace(/\D/g, "");
  const numero = fone && fone.length <= 11 ? `55${fone}` : fone;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// ─── Lista de compras ───────────────────────────────────────────────────────

/* Compras do orçamento: fichas do sistema (abrindo pré-preparos até o cru,
 * com a perda de cada ingrediente) + ingredientes das fichas exclusivas
 * (quantidade ÷ aproveitamento). Quantidade total = porções por pessoa ×
 * pessoas.
 */
export function listaDeComprasDoOrcamento(orc = {}, fichas = [], { convidados: conv } = {}) {
  // Pessoas-equivalentes (criança come uma fração) × sobra de segurança.
  const r = resumoDoOrcamento(orc, fichas, conv !== undefined ? { convidados: conv } : {});
  const pessoas = r.pessoasConsumo * (1 + r.sobraPct / 100);
  const itens = itensDoOrcamento(orc, fichas);
  const doSistema = listaDeComprasDeFichas(
    itens.filter((i) => i.origem !== "exclusiva").map((i) => ({ ficha: i.ficha, nome: i.nome, porcoes: i.porPessoa * pessoas })),
    fichas,
  );
  const acc = new Map();
  for (const i of itens.filter((x) => x.origem === "exclusiva")) {
    for (const ing of i.ingredientes || []) {
      const uso = paraBase(ing.quantidade, ing.unidade_uso);
      const emb = paraBase(ing.tamanho_embalagem, ing.unidade_embalagem);
      const aprov = Math.min(pos(ing.aproveitamento_pct) || 100, 100) / 100;
      const q = uso.q * i.porPessoa * pessoas / aprov;
      const k = `ex:${String(ing.nome || "").trim().toLowerCase()}:${uso.base}`;
      const atual = acc.get(k) || { insumo_id: null, nome: ing.nome || "Ingrediente", unidade: uso.base, categoria: "Exclusivo do evento", quantidade: 0, custo: 0, exclusivo: true };
      atual.quantidade += q;
      if (emb.base === uso.base && emb.q > 0) atual.custo += pos(ing.preco_embalagem) / emb.q * q;
      acc.set(k, atual);
    }
  }
  const exclusivos = [...acc.values()].map((x) => ({ ...x, quantidade: Math.round(x.quantidade * 1000) / 1000, custo: r2(x.custo) }));
  const lista = [...doSistema.itens, ...exclusivos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { itens: lista, total: r2(lista.reduce((t, x) => t + x.custo, 0)), avisos: doSistema.avisos };
}

// ─── Gravação ───────────────────────────────────────────────────────────────

/* O que gravar no evento: o orçamento inteiro dentro de operacao_detalhes
 * (preservando as outras chaves) e as colunas que o funil, a agenda e a tela
 * inicial leem — nome, cliente, data, pessoas, valor e custos.
 */
export function camposDoEventoParaGravar(orc, r, operacaoDetalhesAtual = {}) {
  const c = orc.cliente || {};
  const campos = {
    operacao_detalhes: { ...(operacaoDetalhesAtual || {}), orcamento: orc, resumo: resumoParaFunil(r) },
    nome: c.nome_evento || (c.cliente_nome ? `Evento: ${c.cliente_nome}` : "Novo evento"),
    cliente_nome: c.cliente_nome || null,
    cliente_telefone: c.cliente_telefone || null,
    local_evento: c.local_evento || null,
    hora_inicio: c.hora_inicio || null,
    hora_fim: c.hora_fim || null,
    total_custo_insumos: r.cmv,
    total_custo_equipe: r.equipe,
    custo_aluguel_espaco: r.extras,
    taxa_imposto_pct: pos(orc.financeiro?.imposto_pct),
    taxa_maquininha_pct: pos(orc.financeiro?.maquininha_pct),
  };
  // Sem pessoas ou sem preço, não apaga o que o evento já tinha (evento antigo
  // com valor fechado e sem convidados não pode virar R$ 0 ao abrir).
  if (c.data_evento) campos.data_evento = c.data_evento;
  if (pos(c.convidados) > 0) campos.capacidade = Math.round(pos(c.convidados));
  if (r.receita > 0) campos.valor_contratado = r.receita;
  return campos;
}

// Colunas sem as quais não faz sentido gravar (o resto é descartado se o
// banco não tiver a coluna).
export const CAMPOS_ESSENCIAIS = ["operacao_detalhes", "nome"];

export { novoId };
