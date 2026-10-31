// SIMULADOR DE EVENTO (pedido do dono, 31/10/2026): montar o evento combinando
// modalidades — Mesa montada, Buffet, Bar e Equipe — e ver o resultado na hora,
// sem botão de calcular. Cada modalidade tem a própria conta:
//
//   Mesa montada  custo da porção × quantidade FECHADA (não cresce com convidados;
//                 "divisão financeira por N convidados, sem redimensionar os produtos")
//   Buffet        custo da porção × porções por pessoa × convidados
//   Bar           custo da dose/copo × doses por pessoa × convidados
//   Equipe        quantidade × diária
//
// Custo da porção = o MESMO da ficha técnica no orçamento do evento
// (custoPorcaoDaFicha). Mesma ficha em duas modalidades conta em cada uma o que
// cada uma usa (são quantidades diferentes); a MESMA pessoa da equipe só entra
// uma vez (a equipe é uma lista só, não uma por modalidade).
// "Continuar para precificação" vira o orçamento do evento (orcamentoVazio +
// cardápio + equipe + extras), onde entram imposto, maquininha e meta.
// Sem custo na ficha → item marcado e o total vira ESTIMATIVA, nunca zero inventado.

import { custoPorcaoDaFicha } from "./evento-financeiro.mjs";
import { orcamentoVazio } from "./evento-orcamento.mjs";

const num = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const novoId = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const MODALIDADES = Object.freeze([
  { id: "mesa", rotulo: "Mesa montada", ajuda: "Produtos e quantidades fechadas", campo: "quantidade", sufixo: "porções no total" },
  { id: "buffet", rotulo: "Buffet", ajuda: "Cardápio por pessoa", campo: "por_pessoa", sufixo: "porção por pessoa" },
  { id: "bar", rotulo: "Bar / Open bar", ajuda: "Bebidas e drinks por pessoa", campo: "por_pessoa", sufixo: "doses por pessoa" },
  { id: "equipe", rotulo: "Equipe de atendimento", ajuda: "Pessoas × diária", campo: null },
]);

export function simulacaoVazia() {
  return {
    nome: "", convidados: "", preco_por_pessoa: "", outros_custos: "",
    modalidades: {
      mesa: { ativa: true, itens: [] },
      buffet: { ativa: false, itens: [] },
      bar: { ativa: false, itens: [] },
      equipe: { ativa: false, linhas: [] },
    },
  };
}

/** Lê o que veio salvo sem quebrar com dado incompleto. */
export function normalizarSimulacao(s) {
  const base = simulacaoVazia();
  if (!s || typeof s !== "object") return base;
  const m = s.modalidades || {};
  const itens = (x) => (Array.isArray(x?.itens) ? x.itens : []).filter((i) => i && i.ficha_id).map((i) => ({ id: i.id || novoId(), ficha_id: i.ficha_id, quantidade: i.quantidade ?? "", por_pessoa: i.por_pessoa ?? "" }));
  return {
    nome: String(s.nome || ""), convidados: s.convidados ?? "", preco_por_pessoa: s.preco_por_pessoa ?? "", outros_custos: s.outros_custos ?? "",
    modalidades: {
      mesa: { ativa: m.mesa ? !!m.mesa.ativa : true, itens: itens(m.mesa) },
      buffet: { ativa: !!m.buffet?.ativa, itens: itens(m.buffet) },
      bar: { ativa: !!m.bar?.ativa, itens: itens(m.bar) },
      equipe: { ativa: !!m.equipe?.ativa, linhas: (Array.isArray(m.equipe?.linhas) ? m.equipe.linhas : []).map((l) => ({ id: l.id || novoId(), funcao: String(l.funcao || ""), quantidade: l.quantidade ?? "1", valor: l.valor ?? "" })) },
    },
  };
}

/**
 * Resultado ao vivo. fichas: as fichas técnicas da unidade (com ingredientes),
 * as mesmas do orçamento do evento.
 */
export function calcularSimulacao(sim, fichas = []) {
  const s = normalizarSimulacao(sim);
  const porId = new Map((fichas || []).map((f) => [f.id, f]));
  const convidados = num(s.convidados);
  let semCusto = 0;
  const linhaDaFicha = (i, modo) => {
    const ficha = porId.get(i.ficha_id) || null;
    const custoPorcao = ficha ? (custoPorcaoDaFicha(ficha, fichas) || 0) : 0;
    const qtd = modo === "mesa" ? num(i.quantidade) : num(i.por_pessoa) * convidados;
    if (!(custoPorcao > 0) && qtd > 0) semCusto += 1;
    return { id: i.id, ficha_id: i.ficha_id, nome: ficha?.nome_receita || "Ficha removida", custoPorcao: r2(custoPorcao), porcoes: Math.round(qtd * 100) / 100, custo: r2(custoPorcao * qtd), semCusto: !(custoPorcao > 0) };
  };
  const partes = [];
  for (const m of MODALIDADES) {
    const dado = s.modalidades[m.id];
    if (!dado?.ativa) continue;
    if (m.id === "equipe") {
      const linhas = dado.linhas.map((l) => ({ ...l, custo: r2((l.quantidade === "" ? 1 : num(l.quantidade)) * num(l.valor)) }));
      partes.push({ id: m.id, rotulo: m.rotulo, linhas, custo: r2(linhas.reduce((t, l) => t + l.custo, 0)) });
    } else {
      const linhas = dado.itens.map((i) => linhaDaFicha(i, m.id));
      partes.push({ id: m.id, rotulo: m.rotulo, linhas, custo: r2(linhas.reduce((t, l) => t + l.custo, 0)), fechada: m.id === "mesa" });
    }
  }
  const outros = num(s.outros_custos);
  const custoTotal = r2(partes.reduce((t, p) => t + p.custo, 0) + outros);
  const preco = num(s.preco_por_pessoa);
  const faturamento = preco && convidados ? r2(preco * convidados) : null;
  const saldo = faturamento != null ? r2(faturamento - custoTotal) : null;
  return {
    convidados, partes, outros: r2(outros), custoTotal,
    custoPorConvidado: convidados ? r2(custoTotal / convidados) : null,
    faturamento, saldo,
    saldoPorConvidado: saldo != null && convidados ? r2(saldo / convidados) : null,
    margemPct: saldo != null && faturamento ? Math.round((saldo / faturamento) * 1000) / 10 : null,
    semCusto,
    natureza: semCusto ? "ESTIMATIVA" : "SIMULAÇÃO",
  };
}

/**
 * Vira o orçamento do evento (etapas de precificação, proposta e DRE do evento):
 * mesa montada → itens em quantidade fechada; buffet → porções por pessoa;
 * bar → doses por pessoa na seção Bar; equipe e outros custos nas próprias abas.
 */
export function orcamentoDaSimulacao(sim, fichas = [], params = {}) {
  const s = normalizarSimulacao(sim);
  const porId = new Map((fichas || []).map((f) => [f.id, f]));
  const orc = orcamentoVazio(params);
  orc.tipo = "buffet";
  const item = (i, extra) => {
    const f = porId.get(i.ficha_id);
    return { id: novoId(), origem: "ficha", ficha_id: i.ficha_id, nome: f?.nome_receita || "", descricao: "", custo_porcao_gravado: f ? (custoPorcaoDaFicha(f, fichas) || 0) : 0, ...extra };
  };
  const m = s.modalidades;
  if (m.mesa.ativa) for (const i of m.mesa.itens) orc.cardapio.push(item(i, { secao: "buffet", medida: "total", quantidade_total: String(num(i.quantidade) || 1), por_pessoa: "1" }));
  if (m.buffet.ativa) for (const i of m.buffet.itens) orc.cardapio.push(item(i, { secao: "buffet", por_pessoa: String(num(i.por_pessoa) || 1) }));
  if (m.bar.ativa) for (const i of m.bar.itens) orc.cardapio.push(item(i, { secao: "bar", por_pessoa: String(num(i.por_pessoa) || 1) }));
  if (m.equipe.ativa) for (const l of m.equipe.linhas) orc.equipe.push({ id: novoId(), area: "Salão", funcao: l.funcao, nome: "", quantidade: String(l.quantidade || "1"), modo: "diaria", horas: "", valor: String(l.valor || "") });
  if (num(s.outros_custos)) orc.extras.push({ id: novoId(), categoria: "outros", descricao: "Outros custos (simulador)", valor: String(num(s.outros_custos)) });
  orc.cliente.nome_evento = s.nome;
  orc.cliente.convidados = num(s.convidados);
  if (num(s.preco_por_pessoa)) orc.financeiro.preco_por_pessoa = num(s.preco_por_pessoa);
  return orc;
}
