// ANOMALIA → INSIGHT:  SITUAÇÃO → EVIDÊNCIA → POSSÍVEIS CAUSAS → IMPACTO → RECOMENDAÇÃO
//
// Tudo determinístico, sobre os números que vieram das métricas (com fonte).
// Linguagem de incerteza é obrigatória: "Possível causa", "Principal fator
// identificado" só quando um fator domina, "Não foi possível determinar com
// segurança" quando não. Correlação nunca é apresentada como causa.

import { CATALOGO, OPCOES } from "./catalogo.mjs";
import { SEVERIDADE } from "../anomalies/detectores.mjs";
import { ddmm } from "../core/periodos.mjs";
import { NATUREZA } from "../core/contratos.mjs";

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const pct = (v) => `${v > 0 ? "+" : ""}${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const pp = (v) => `${v > 0 ? "+" : ""}${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;

export const ORDEM_NIVEL = Object.freeze({ critico: 0, importante: 1, oportunidade: 2, informacao: 3 });
export const ROTULO_NIVEL = Object.freeze({ critico: "CRÍTICO", importante: "IMPORTANTE", oportunidade: "OPORTUNIDADE", informacao: "INFORMAÇÃO" });

/** Impressão digital estável do insight (dedupe e feedback). */
export function impressao(unidadeId, tipo, chave) {
  const t = `${unidadeId}|${tipo}|${chave}`;
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return `${tipo}:${h.toString(16).padStart(8, "0")}`;
}

function preencher(texto, vars) {
  return String(texto || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

/** Ordena hipóteses pelo que a unidade já confirmou antes (aprendizado persistido). */
export function ordenarCausas(tipo, aprendizado = {}) {
  const def = CATALOGO[tipo]?.causas || [];
  const contagem = aprendizado?.[tipo] || {};
  return def
    .map(([id, texto], i) => ({ id, texto, vezes: Number(contagem[id]) || 0, i }))
    .sort((a, b) => b.vezes - a.vezes || a.i - b.i)
    .map(({ id, texto, vezes }) => ({ id, texto, qualificador: "Possível causa", historico: vezes ? `confirmada ${vezes} vez(es) nesta unidade` : null }));
}

function corpo(a) {
  const d = a.dados || {};
  switch (a.tipo) {
    case "contagem_falta":
    case "contagem_sobra": {
      const falta = a.tipo === "contagem_falta";
      const q = `${num(Math.abs(d.diferenca))} ${d.unidade}`;
      return {
        titulo: `${falta ? "Possível divergência" : "Sobra"} de ${d.produto} no inventário`,
        situacao: `No inventário de ${d.inventario?.data ? ddmm(d.inventario.data) : "—"}, ${d.produto} ${falta ? "estava abaixo" : "estava acima"} do esperado pelo sistema.`,
        evidencias: [
          { rotulo: "Esperado (sistema)", valor: `${num(d.esperado)} ${d.unidade}` },
          { rotulo: "Contado", valor: `${num(d.contado)} ${d.unidade}` },
          { rotulo: "Diferença", valor: `${d.diferenca > 0 ? "+" : "−"}${q}${d.pct != null ? ` (${pct(d.pct)})` : ""}` },
        ],
        impacto: d.valor != null ? { texto: `${brl(Math.abs(d.valor))} ao custo congelado na contagem`, valor: Math.abs(d.valor), natureza: NATUREZA.REAL } : null,
        vars: { quantidade: q, produto: d.produto },
        acoes: [{ rotulo: "Ver contagem", rota: "/dashboard/operacao/estoque/contagens" }],
        aprofundar: `Por que ${d.produto} ${falta ? "faltou" : "sobrou"} no inventário?`,
      };
    }
    case "faturamento_queda":
    case "faturamento_alta": {
      const b = d.baseline;
      const queda = a.tipo === "faturamento_queda";
      return {
        titulo: queda ? `Faturamento de ${d.diaSemana} abaixo do padrão` : `Faturamento de ${d.diaSemana} acima do padrão`,
        situacao: `O faturamento de ${ddmm(d.data)} ficou ${pct(b.diferencaPct)} em relação à média das últimas ${b.n} ${d.diaSemana}s.`,
        evidencias: [
          { rotulo: `Faturamento ${ddmm(d.data)}`, valor: brl(d.atual) },
          { rotulo: `Média de ${b.n} ${d.diaSemana}s`, valor: brl(b.media) },
          { rotulo: "Desvio", valor: `${brl(b.diferenca)} (${pct(b.diferencaPct)})` },
        ],
        impacto: { texto: `${brl(Math.abs(b.diferenca))} ${queda ? "abaixo" : "acima"} da média do mesmo dia da semana`, valor: Math.abs(b.diferenca), natureza: NATUREZA.REAL },
        vars: {},
        acoes: [{ rotulo: "Ver faturamento", rota: "/dashboard/operacao/estoque/cmv" }],
        aprofundar: "Como foi o faturamento esta semana?",
      };
    }
    case "faturamento_dias_faltando":
      return {
        titulo: "Faturamento sem lançamento",
        situacao: `${d.faltando.length} dia(s) recente(s) sem faturamento lançado: ${d.faltando.map(ddmm).join(", ")}.`,
        evidencias: [{ rotulo: "Dias sem lançamento", valor: d.faltando.map(ddmm).join(", ") }],
        impacto: { texto: "CMV %, CMO % e DRE desses dias ficam sem apuração", valor: null, natureza: NATUREZA.REAL },
        vars: {}, acoes: [{ rotulo: "Lançar faturamento", rota: "/dashboard/operacao/estoque/cmv" }], aprofundar: null,
      };
    case "preco_alta":
    case "preco_queda": {
      const alta = a.tipo === "preco_alta";
      const ref = d.mediaAnteriores != null && d.comprasAnteriores > 1
        ? { rotulo: `Média das ${d.comprasAnteriores} compras anteriores`, valor: `${brl(d.mediaAnteriores)}/${d.unidade}` }
        : { rotulo: `Compra anterior (${ddmm(d.dataAnterior)})`, valor: `${brl(d.precoAnterior)}/${d.unidade}` };
      return {
        titulo: `${d.nome} ficou ${pct(Math.abs(d.pctReferencia)).replace("+", "")} ${alta ? "mais cara" : "mais barata"}`,
        situacao: `Na compra de ${ddmm(d.dataAtual)}${d.fornecedorAtual ? ` (${d.fornecedorAtual})` : ""}, ${d.nome} custou ${brl(d.precoAtual)}/${d.unidade}.`,
        evidencias: [ref, { rotulo: `Última compra (${ddmm(d.dataAtual)})`, valor: `${brl(d.precoAtual)}/${d.unidade}` }, { rotulo: "Variação", valor: pct(d.pctReferencia) }],
        impacto: { texto: `${brl(Math.abs(d.precoAtual - (d.mediaAnteriores ?? d.precoAnterior)))} por ${d.unidade}`, valor: null, natureza: NATUREZA.REAL },
        vars: { produto: d.nome },
        acoes: [{ rotulo: "Ver compras", rota: "/dashboard/operacao/estoque/compras" }],
        aprofundar: "Quais produtos aumentaram de preço?",
      };
    }
    case "compras_alta": {
      const b = d.baseline;
      return {
        titulo: "Compras da semana acima do padrão",
        situacao: `As compras confirmadas nesta semana ficaram ${pct(b.diferencaPct)} acima da média das ${b.n} semanas anteriores (mesmos dias).`,
        evidencias: [{ rotulo: "Esta semana", valor: brl(d.atual) }, { rotulo: `Média de ${b.n} semanas`, valor: brl(b.media) },
          ...d.itens.map((i) => ({ rotulo: i.nome, valor: `${brl(i.valor)} (${num(i.quantidade)} ${i.unidade})` }))],
        impacto: { texto: `${brl(b.diferenca)} acima da média`, valor: b.diferenca, natureza: NATUREZA.REAL },
        vars: {}, acoes: [{ rotulo: "Ver compras", rota: "/dashboard/operacao/estoque/compras" }], aprofundar: "Quanto comprei esta semana?",
      };
    }
    case "perdas_alta": {
      const b = d.baseline;
      return {
        titulo: "Perdas acima do padrão",
        situacao: `As perdas registradas no período estão ${pct(b.diferencaPct)} acima da média das ${b.n} semanas anteriores.`,
        evidencias: [{ rotulo: "No período", valor: brl(d.atual) }, { rotulo: `Média de ${b.n} semanas`, valor: brl(b.media) },
          ...d.porProduto.map((p) => ({ rotulo: p.produto, valor: `${brl(p.valor)} (${num(p.quantidade)} ${p.unidade})` }))],
        impacto: { texto: `${brl(b.diferenca)} acima da média`, valor: b.diferenca, natureza: NATUREZA.REAL },
        vars: {}, acoes: [{ rotulo: "Ver estoque", rota: "/dashboard/operacao/estoque?gestao=1" }], aprofundar: null,
      };
    }
    case "produto_vencido":
    case "produto_vencendo": {
      const vencido = a.tipo === "produto_vencido";
      const lotes = d.lotes || [];
      const valor = lotes.every((l) => l.valorEstimado != null) ? lotes.reduce((t, l) => t + l.valorEstimado, 0) : null;
      const prim = lotes[0];
      return {
        titulo: vencido ? `${lotes.length} lote(s) vencido(s) ainda em estoque` : `${lotes.length} lote(s) vencendo nos próximos dias`,
        situacao: vencido
          ? `${prim.produto} venceu em ${ddmm(prim.validade)} e ainda tem ${num(prim.quantidade)} ${prim.unidade} em ${prim.local}.`
          : `${prim.produto}: ${num(prim.quantidade)} ${prim.unidade} vencem em ${ddmm(prim.validade)} (${prim.diasParaVencer} dia(s)).`,
        evidencias: lotes.slice(0, 5).map((l) => ({ rotulo: `${l.produto} · ${l.local}`, valor: `${num(l.quantidade)} ${l.unidade} · validade ${ddmm(l.validade)}` })),
        impacto: valor != null ? { texto: `${brl(valor)} ao custo médio`, valor: Math.round(valor * 100) / 100, natureza: NATUREZA.ESTIMATIVA } : null,
        vars: {},
        acoes: vencido
          ? [{ rotulo: "Registrar perda", comando: `Registrar perda de ${num(prim.quantidade)} ${prim.unidade} de ${prim.produto} por vencimento` }, { rotulo: "Ver validades", rota: "/dashboard/operacao/validade" }]
          : [{ rotulo: "Ver validades", rota: "/dashboard/operacao/validade" }],
        aprofundar: "Quais produtos estão próximos do vencimento?",
      };
    }
    case "contas_vencidas":
    case "contas_hoje": {
      const vencidas = a.tipo === "contas_vencidas";
      return {
        titulo: vencidas ? `${d.qtd} conta(s) vencida(s)` : `${d.qtd} conta(s) vencem hoje`,
        situacao: `${vencidas ? "Contas em aberto com vencimento passado" : "Contas a pagar com vencimento hoje"}: ${brl(d.valor)} no total.`,
        evidencias: d.lista.slice(0, 5).map((c) => ({ rotulo: `${c.descricao}${c.fornecedor ? ` · ${c.fornecedor}` : ""}`, valor: `${brl(c.saldo)} · ${ddmm(c.vencimento)}` })),
        impacto: { texto: `${brl(d.valor)} em aberto`, valor: d.valor, natureza: NATUREZA.REAL },
        vars: {}, acoes: [{ rotulo: "Abrir contas a pagar", rota: "/dashboard/financeiro/contas" }], aprofundar: "Quais contas vencem nos próximos dias?",
      };
    }
    case "cmv_alta": {
      const ev = [{ rotulo: `CMV ${a.periodo.rotulo || ""}`.trim(), valor: `${num(d.atual)}%` }];
      if (d.media != null) ev.push({ rotulo: `Média de ${d.periodosMedia} períodos anteriores`, valor: `${num(d.media)}% (${pp(d.vsMedia)})` });
      if (d.anterior != null) ev.push({ rotulo: "Período anterior", valor: `${num(d.anterior)}% (${pp(d.vsAnterior)})` });
      return {
        titulo: "CMV acima do padrão da casa",
        situacao: `O CMV real do último período apurado foi ${num(d.atual)}%${d.media != null ? `, ${pp(d.vsMedia)} acima da média própria` : `, ${pp(d.vsAnterior)} sobre o período anterior`}.`,
        evidencias: ev, impacto: null, vars: {},
        acoes: [{ rotulo: "Abrir CMV real", rota: "/dashboard/operacao/estoque/cmv" }],
        aprofundar: "Por que o CMV subiu?",
      };
    }
    case "estoque_abaixo_minimo":
      return {
        titulo: `${d.total} item(ns) abaixo do estoque mínimo`,
        situacao: `${d.itens[0].produto} tem ${num(d.itens[0].saldo)} ${d.itens[0].unidade} (mínimo ${num(d.itens[0].minimo)}).`,
        evidencias: d.itens.slice(0, 5).map((i) => ({ rotulo: `${i.produto} · ${i.local}`, valor: `${num(i.saldo)} de ${num(i.minimo)} ${i.unidade}` })),
        impacto: null, vars: {}, acoes: [{ rotulo: "Ver estoque", rota: "/dashboard/operacao/estoque?gestao=1" }], aprofundar: null,
      };
    case "saldo_lotes_divergente":
      return {
        titulo: "Saldo diferente da soma dos lotes",
        situacao: `${d.total} produto(s) com saldo que não bate com a soma dos lotes por validade.`,
        evidencias: d.itens.slice(0, 5).map((i) => ({ rotulo: i.produto, valor: `saldo ${num(i.saldo)} · lotes ${num(i.somaDosLotes)}` })),
        impacto: null, vars: {}, acoes: [{ rotulo: "Ver estoque", rota: "/dashboard/operacao/estoque?gestao=1" }], aprofundar: null,
      };
    default:
      return null;
  }
}

/** CMV: os fatores vêm dos números do motor do CMV, nunca de suposição. */
function fatoresCmv(d) {
  const out = [];
  const c = d.contribuicoes || {};
  if (c.compras?.valor > 0) out.push({ id: "compras", texto: `Compras ${brl(c.compras.valor)} maiores que no período anterior${c.compras.pct != null ? ` (${pct(c.compras.pct)})` : ""}`, qualificador: "Possível causa" });
  if (c.estoqueFinal?.valor < 0) out.push({ id: "estoque_final", texto: `Estoque final ${brl(Math.abs(c.estoqueFinal.valor))} menor (mais consumo ou perda no período)`, qualificador: "Possível causa" });
  if (c.faturamento?.valor < 0) out.push({ id: "faturamento", texto: `Faturamento ${brl(Math.abs(c.faturamento.valor))} menor${c.faturamento.pct != null ? ` (${pct(c.faturamento.pct)})` : ""}`, qualificador: "Possível causa" });
  for (const al of (d.alertas || []).slice(0, 3)) out.push({ id: `alerta_${al.tipo}`, texto: al.texto, qualificador: "Sinal no período" });
  return out;
}

/**
 * @param {object} a           anomalia
 * @param {object} ctx         { unidadeId, aprendizado, apuradoEm }
 */
export function montarInsight(a, { unidadeId, aprendizado = {}, apuradoEm } = {}) {
  const c = corpo(a);
  if (!c) return null;
  const cat = CATALOGO[a.tipo] || {};
  let possiveisCausas = ordenarCausas(a.tipo, aprendizado);
  let fatorPrincipal = null;
  if (a.tipo === "cmv_alta") {
    possiveisCausas = fatoresCmv(a.dados);
    fatorPrincipal = { texto: "Não foi possível determinar com segurança qual fator pesou mais: os números abaixo mostram o que mudou.", qualificador: "Não foi possível determinar com segurança" };
  } else if (possiveisCausas.length && possiveisCausas[0].historico) {
    fatorPrincipal = { texto: `${possiveisCausas[0].texto} — ${possiveisCausas[0].historico}.`, qualificador: "Mais frequente nesta unidade (não confirmado para este caso)" };
  }
  const pergunta = cat.pergunta ? { texto: preencher(cat.pergunta, c.vars), opcoes: cat.opcoes } : null;
  return Object.freeze({
    id: impressao(unidadeId, a.tipo, a.chave),
    tipo: a.tipo,
    nivel: a.severidade,
    nivelRotulo: ROTULO_NIVEL[a.severidade],
    modulo: a.modulo,
    titulo: c.titulo,
    situacao: c.situacao,
    evidencias: c.evidencias,
    possiveisCausas,
    fatorPrincipal,
    impacto: c.impacto,
    recomendacao: preencher(cat.recomendacao, c.vars) || null,
    pergunta,
    acoes: c.acoes || [],
    aprofundar: c.aprofundar ? { comando: c.aprofundar } : null,
    entidade: a.entidade,
    fontes: a.fontes,
    periodo: a.periodo,
    confianca: a.confianca,
    apuradoEm: apuradoEm || null,
  });
}

export function ordenarInsights(lista) {
  return [...lista].sort((x, y) => (ORDEM_NIVEL[x.nivel] - ORDEM_NIVEL[y.nivel]) || ((y.impacto?.valor || 0) - (x.impacto?.valor || 0)));
}

export { SEVERIDADE, OPCOES };
