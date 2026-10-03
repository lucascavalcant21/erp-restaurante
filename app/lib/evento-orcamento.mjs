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
    cliente: {
      nome_evento: "", cliente_nome: "", cliente_telefone: "", data_evento: "", convidados: 0,
      local_evento: "", hora_inicio: "", hora_fim: "", forma_pagamento: "", observacoes: "",
    },
    financeiro: {
      imposto_pct: pos(params.imposto_pct),
      maquininha_pct: pos(params.taxa_cartao_pct),
      meta_lucro_pct: pos(params.margem_alvo_pct),
      prolabore: { modo: "pct", valor: 0 },
      comissoes: [],
      preco_por_pessoa: 0,
    },
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
    return {
      ...base, ...salvo,
      cardapio: Array.isArray(salvo.cardapio) ? salvo.cardapio : [],
      equipe: Array.isArray(salvo.equipe) ? salvo.equipe : [],
      extras: Array.isArray(salvo.extras) ? salvo.extras : [],
      // As colunas do evento mandam nos dados do cliente (o funil e a agenda
      // também editam nome, data e convidados).
      cliente: { ...base.cliente, ...(salvo.cliente || {}), ...Object.fromEntries(Object.entries(clienteDoEvento).filter(([, v]) => temValor(v) && v !== 0)) },
      financeiro: { ...base.financeiro, ...(salvo.financeiro || {}),
        prolabore: { ...base.financeiro.prolabore, ...(salvo.financeiro?.prolabore || {}) },
        comissoes: Array.isArray(salvo.financeiro?.comissoes) ? salvo.financeiro.comissoes : [] },
    };
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
 */
export function itensDoOrcamento(orc = {}, fichas = []) {
  const porId = new Map((fichas || []).map((f) => [f.id, f]));
  return (orc.cardapio || []).map((item) => {
    const secao = secaoDoItem(item, orc.tipo);
    const porPessoa = pos(item.por_pessoa);
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
    return { ...item, secao, ficha, porPessoa, custoPorcao, custoPorPessoa: custoPorcao * porPessoa, aoVivo, problemas, semCusto: !(custoPorcao > 0) };
  });
}

// ─── Resumo: custo por pessoa, preço sugerido e DRE do evento ───────────────

const valorDaRegra = (regra, receita) => (regra?.modo === "valor" ? pos(regra.valor) : receita * pos(regra?.valor) / 100);

/* Contas do orçamento (receita = preço por pessoa × convidados):
 *   CMV ............ Σ custo por pessoa × convidados
 *   Equipe ......... Σ quantidade × valor
 *   Extras ......... aluguel, decoração, música, outros
 *   Imposto, maquininha, comissões em %, pró-labore em % → sobre a receita
 *   Comissões e pró-labore em R$ → valor fixo
 *   Lucro limpo = receita − tudo acima
 * Preço sugerido por pessoa = custos fixos ÷ (1 − Σ% − meta de lucro%) ÷ convidados
 * Preço mínimo = o mesmo com meta 0 (lucro limpo zero).
 */
export function resumoDoOrcamento(orc = {}, fichas = [], { convidados: conv } = {}) {
  const convidados = pos(conv ?? orc?.cliente?.convidados);
  const fin = orc.financeiro || {};
  const itens = itensDoOrcamento(orc, fichas);
  const cmvPorPessoa = itens.reduce((t, i) => t + i.custoPorPessoa, 0);
  const cmvBebidaPP = itens.filter((i) => i.secao === "bar").reduce((t, i) => t + i.custoPorPessoa, 0);
  const cmvComida = r2((cmvPorPessoa - cmvBebidaPP) * convidados);
  const cmvBebida = r2(cmvBebidaPP * convidados);
  const cmv = r2(cmvComida + cmvBebida);

  const equipe = r2((orc.equipe || []).reduce((t, p) => t + pos(p.quantidade || 1) * pos(p.valor), 0));
  const pessoasEquipe = (orc.equipe || []).reduce((t, p) => t + pos(p.quantidade || 1), 0);
  const extrasPorCategoria = CATEGORIAS_EXTRAS.map((c) => ({ ...c, valor: r2((orc.extras || []).filter((x) => (x.categoria || "outros") === c.id).reduce((t, x) => t + pos(x.valor), 0)) }));
  const extras = r2(extrasPorCategoria.reduce((t, c) => t + c.valor, 0));

  const precoPorPessoa = pos(fin.preco_por_pessoa);
  const receita = r2(precoPorPessoa * convidados);
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
    return Math.ceil((fixos / (sobra / 100) / convidados) * 100) / 100; // arredonda para cima: nunca abaixo da meta
  };

  const pct = (v) => percentualDe(v, receita);
  const L = (id, rotulo, valor, tipo = "custo", extra = {}) => ({ id, rotulo, valor, pct: pct(valor), porPessoa: convidados > 0 ? r2(valor / convidados) : null, tipo, ...extra });
  const dre = [
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
    convidados, itens, dre,
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
    precoMinimoPorPessoa: precoPara(0),
    prejuizo: receita > 0 && lucro < 0,
    semCusto: itens.filter((i) => i.semCusto).map((i) => i.nome),
  };
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
  if (r.precoPorPessoa > 0) {
    linhas.push(`*Valor por pessoa: ${fmtR(r.precoPorPessoa)}*${r.convidados ? `\nTotal para ${r.convidados} pessoas: ${fmtR(r.receita)}` : ""}`);
  }
  if (c.forma_pagamento) linhas.push(`Forma de pagamento: ${c.forma_pagamento}`);
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
  const convidados = pos(conv ?? orc?.cliente?.convidados);
  const itens = itensDoOrcamento(orc, fichas);
  const doSistema = listaDeComprasDeFichas(
    itens.filter((i) => i.origem !== "exclusiva").map((i) => ({ ficha: i.ficha, nome: i.nome, porcoes: i.porPessoa * convidados })),
    fichas,
  );
  const acc = new Map();
  for (const i of itens.filter((x) => x.origem === "exclusiva")) {
    for (const ing of i.ingredientes || []) {
      const uso = paraBase(ing.quantidade, ing.unidade_uso);
      const emb = paraBase(ing.tamanho_embalagem, ing.unidade_embalagem);
      const aprov = Math.min(pos(ing.aproveitamento_pct) || 100, 100) / 100;
      const q = uso.q * i.porPessoa * convidados / aprov;
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
    operacao_detalhes: { ...(operacaoDetalhesAtual || {}), orcamento: orc },
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
