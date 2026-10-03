// Eventos (Reservas e Eventos): funil, custo, preço e lista de compras.
// FONTE ÚNICA das telas do evento. Funções puras (testes em
// evento-financeiro.test.mjs). O custo de cada prato vem da mesma conta das
// fichas técnicas — perda do ingrediente, porções, subfichas —, não de uma
// fórmula própria.

import {
  custoDeProduzirFicha, porcoesParaCusto, converterParaBaseDoInsumo, parseNumero,
} from "./ficha-calculos.mjs";
import { unidadeNormalizada as unidadeBaseDoInsumo } from "./ingredientes-utils.mjs";
import { custoDoInsumo, fatorCorrecaoDoItem } from "./custo-rendimento.mjs";
import { DESPESAS_VARIAVEIS } from "./composicao-preco.mjs";
import { percentualDe } from "./valor-percentual.mjs";

const pos = (v) => Math.max(0, parseNumero(v));
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// ─── Funil ──────────────────────────────────────────────────────────────────
// Lista única de etapas. O kanban e o seletor dentro do evento tinham listas
// diferentes ("NEGOCIACAO" num, "NEGOCIAÇÃO" no outro): escolher a etapa no
// evento fazia ele sumir do funil.
export const FUNIL_ETAPAS = [
  "NOVO CONTATO", "INFORMACOES RECEBIDAS", "MONTANDO PROPOSTA", "PROPOSTA ENVIADA", "NEGOCIACAO",
  "APROVADO", "AGUARDANDO SINAL", "SINAL PAGO", "CONFIRMADO", "PREPARACAO", "EM PRODUCAO", "EVENTO", "FINALIZADO",
  "CANCELADO",
];
const ROTULO_ETAPA = {
  "INFORMACOES RECEBIDAS": "Informações recebidas", "NEGOCIACAO": "Negociação", "PREPARACAO": "Preparação", "EM PRODUCAO": "Em produção",
};
export const rotuloEtapa = (e) => ROTULO_ETAPA[e] || (e.charAt(0) + e.slice(1).toLowerCase());

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
// Etapa gravada (com ou sem acento, de qualquer versão da tela) → etapa da lista.
export function normalizarEtapa(status) {
  const s = semAcento(status);
  if (!s) return "NOVO CONTATO";
  return FUNIL_ETAPAS.includes(s) ? s : "NOVO CONTATO";
}

// ─── Custo dos pratos ───────────────────────────────────────────────────────

// Custo de UMA porção da ficha: custo da receita ÷ porções (porcoesParaCusto).
export function custoPorcaoDaFicha(ficha, fichas = []) {
  if (!ficha) return null;
  return custoDeProduzirFicha(ficha, fichas) / porcoesParaCusto(ficha).porcoes;
}

// Itens do cardápio do evento com o custo ATUAL da ficha. Ficha removida:
// usa o custo gravado no item e marca, para a tela avisar.
export function itensDoEvento(evento = {}, fichas = []) {
  const porId = new Map((fichas || []).map((f) => [f.id, f]));
  return (Array.isArray(evento?.cardapio_itens) ? evento.cardapio_itens : []).map((i) => {
    const ficha = porId.get(i.ficha_id) || null;
    const vivo = ficha ? custoPorcaoDaFicha(ficha, fichas) : null;
    const custoPorcao = vivo ?? pos(i.custo_porcao ?? i.custo_unidade);
    const qtd = pos(i.quantidade_servida);
    return { ...i, ficha, custoPorcao, aoVivo: vivo !== null, quantidade: qtd, custoTotal: custoPorcao * qtd };
  });
}

// ─── Resumo financeiro do evento ────────────────────────────────────────────

/* receita = valor contratado
 * (−) CMV ................ Σ custo da porção × porções servidas
 * (−) equipe ............. diárias da equipe do evento
 * (−) custos extras ...... aluguel do espaço, fretes, limpeza extra
 * (−) imposto, maquininha  % do evento, ou o da casa
 * (=) resultado
 * Preço sugerido = (CMV + equipe + extras) ÷ (1 − imposto% − maquininha% − meta de lucro%)
 */
export function resumoDoEvento(evento = {}, fichas = [], params = {}) {
  const itens = itensDoEvento(evento, fichas);
  const convidados = pos(evento.capacidade);
  const receita = pos(evento.valor_contratado);
  const cmv = r2(itens.reduce((t, i) => t + i.custoTotal, 0));
  const equipe = r2(pos(evento.total_custo_equipe));
  const extras = r2(pos(evento.custo_aluguel_espaco));
  const temTaxa = (v) => v !== null && v !== undefined && v !== "";
  const impostoPct = temTaxa(evento.taxa_imposto_pct) ? pos(evento.taxa_imposto_pct) : pos(params.imposto_pct);
  const maquininhaPct = temTaxa(evento.taxa_maquininha_pct) ? pos(evento.taxa_maquininha_pct) : pos(params.taxa_cartao_pct);
  const outrasPct = DESPESAS_VARIAVEIS.filter(([k]) => !["imposto_pct", "taxa_cartao_pct"].includes(k)).reduce((t, [k]) => t + pos(params[k]), 0);
  const imposto = r2(receita * impostoPct / 100);
  const maquininha = r2(receita * maquininhaPct / 100);
  const resultado = r2(receita - cmv - equipe - extras - imposto - maquininha);
  const pct = (v) => percentualDe(v, receita);
  const metaPct = pos(params.margem_alvo_pct);
  const custoDireto = cmv + equipe + extras;
  const sobra = 100 - impostoPct - maquininhaPct - outrasPct - metaPct;
  const precoSugerido = custoDireto > 0 && sobra > 0 ? r2(custoDireto / (sobra / 100)) : null;
  const recebido = r2((Array.isArray(evento.historico_pagamentos) ? evento.historico_pagamentos : []).reduce((t, p) => t + pos(p.valor), 0));
  return {
    itens, convidados, receita,
    linhas: [
      { id: "cmv", rotulo: "CMV do cardápio", valor: cmv, pct: pct(cmv), natureza: "calculado" },
      { id: "equipe", rotulo: "Equipe do evento", valor: equipe, pct: pct(equipe), natureza: "real" },
      { id: "extras", rotulo: "Espaço e custos extras", valor: extras, pct: pct(extras), natureza: "real" },
      { id: "imposto", rotulo: `Imposto (${impostoPct.toLocaleString("pt-BR")}%)`, valor: imposto, pct: pct(imposto), natureza: "configurado" },
      { id: "maquininha", rotulo: `Maquininha (${maquininhaPct.toLocaleString("pt-BR")}%)`, valor: maquininha, pct: pct(maquininha), natureza: "configurado" },
    ],
    resultado: { valor: resultado, pct: pct(resultado), prejuizo: receita > 0 && resultado < 0 },
    cmv, equipe, extras, impostoPct, maquininhaPct,
    custoPorConvidado: convidados > 0 ? r2((cmv + equipe + extras) / convidados) : null,
    receitaPorConvidado: convidados > 0 && receita > 0 ? r2(receita / convidados) : null,
    meta: { pct: metaPct > 0 ? metaPct : null },
    precoSugerido,
    precoSugeridoPorConvidado: precoSugerido && convidados > 0 ? r2(precoSugerido / convidados) : null,
    recebido,
    pendente: r2(receita - recebido),
    semCusto: itens.filter((i) => !(i.custoPorcao > 0)).map((i) => i.nome),
    fichasRemovidas: itens.filter((i) => !i.aoVivo).map((i) => i.nome),
  };
}

// Pendências reais do evento — cada uma sai de um dado, nunca inventada.
export function pendenciasDoEvento(evento = {}, resumo, hojeIso) {
  const lista = [];
  const etapa = normalizarEtapa(evento.funil_status);
  if (!resumo.itens.length) lista.push("Cardápio não montado.");
  if (resumo.semCusto.length) lista.push(`Sem custo na ficha: ${resumo.semCusto.join(", ")}.`);
  if (resumo.fichasRemovidas.length) lista.push(`Ficha removida (custo congelado): ${resumo.fichasRemovidas.join(", ")}.`);
  if (!(resumo.convidados > 0)) lista.push("Número de convidados não informado.");
  if (!(resumo.receita > 0)) lista.push("Valor do evento não definido.");
  if (resumo.resultado.prejuizo) lista.push("O valor contratado não cobre os custos do evento.");
  const data = String(evento.data_evento || "").slice(0, 10);
  if (data && hojeIso && data < hojeIso && !["FINALIZADO", "CANCELADO"].includes(etapa)) lista.push("A data já passou e o evento não foi finalizado no funil.");
  if (resumo.receita > 0 && resumo.pendente > 0.009 && ["CONFIRMADO", "PREPARACAO", "EM PRODUCAO", "EVENTO", "FINALIZADO"].includes(etapa)) {
    lista.push(`Falta receber R$ ${resumo.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
  }
  return lista;
}

// ─── Lista de compras ───────────────────────────────────────────────────────

/* O que comprar para o evento: cada prato × porções servidas, descendo em
 * TODAS as subfichas (o pré-preparo é feito na hora a partir do cru), com a
 * quantidade BRUTA (perda do ingrediente) na unidade do cadastro e o custo de
 * compra. Ingredientes iguais em pratos diferentes somam numa linha só.
 */
export function listaDeComprasDoEvento(evento = {}, fichas = []) {
  return listaDeComprasDeFichas(
    itensDoEvento(evento, fichas).map((i) => ({ ficha: i.ficha, nome: i.nome, porcoes: i.quantidade })),
    fichas,
  );
}

// Compras de uma lista de { ficha, nome, porcoes } — usada pelo cardápio
// antigo e pelo orçamento em etapas (evento-orcamento.mjs).
export function listaDeComprasDeFichas(entradas = [], fichas = []) {
  const porId = new Map((fichas || []).map((f) => [f.id, f]));
  const acc = new Map();
  const avisos = [];
  const visitar = (ficha, receitas, trilha) => {
    if (!ficha || trilha.has(ficha.id)) { if (ficha) avisos.push(`Referência circular em ${ficha.nome_receita}.`); return; }
    const caminho = new Set(trilha).add(ficha.id);
    for (const fi of ficha.fichas_ingredientes || []) {
      if (fi.insumos) {
        const ins = fi.insumos;
        const fc = fatorCorrecaoDoItem(ins, fi.fator_correcao);
        const q = pos(fi.quantidade) * receitas * (1 + fc / 100); // na unidade do insumo
        const base = unidadeBaseDoInsumo(ins.unidade_medida) || String(ins.unidade_medida || "un").toLowerCase();
        const qBase = converterParaBaseDoInsumo(q, ins.unidade_medida, base);
        const custoBase = custoDoInsumo({ ...ins, empanado: false }).custoCompra;
        const k = ins.id || ins.nome;
        const atual = acc.get(k) || { insumo_id: ins.id || null, nome: ins.nome || "Ingrediente", unidade: String(ins.unidade_medida || "un").toLowerCase(), categoria: ins.categoria || "", quantidade: 0, custo: 0 };
        atual.quantidade += q;
        atual.custo += qBase * custoBase;
        acc.set(k, atual);
      } else if (fi.subficha_id) {
        const base = porId.get(fi.subficha_id);
        if (!base) { avisos.push(`Pré-preparo removido em ${ficha.nome_receita}.`); continue; }
        const rend = pos(base.rendimento_porcoes) || 1;
        const q = pos(fi.quantidade) * receitas * (1 + pos(fi.fator_correcao) / 100);
        visitar(base, q / rend, caminho);
      }
    }
  };
  for (const item of entradas) {
    if (!item.ficha) { avisos.push(`${item.nome}: ficha removida, fora da lista.`); continue; }
    visitar(item.ficha, pos(item.porcoes) / porcoesParaCusto(item.ficha).porcoes, new Set());
  }
  const itens = [...acc.values()]
    .map((x) => ({ ...x, quantidade: Math.round(x.quantidade * 1000) / 1000, custo: r2(x.custo) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { itens, total: r2(itens.reduce((t, x) => t + x.custo, 0)), avisos };
}
