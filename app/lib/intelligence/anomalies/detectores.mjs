// DETECTORES — regras + estatística simples sobre as métricas já apuradas.
// Um detector não lê banco: recebe métricas com contrato (fonte, período,
// escopo) e devolve ANOMALIAS (desvios com evidência). Anomalia ainda não é
// insight: quem explica e recomenda é insights/.
//
// Métrica insuficiente ou sem permissão → o detector não dispara.

import { temValor } from "../core/contratos.mjs";
import { diaDaSemana, nomeDiaSemana, ddmm, somarDias } from "../core/periodos.mjs";
import { compararComBaseline, desvioRelevante } from "./baseline.mjs";

export const SEVERIDADE = Object.freeze({ CRITICO: "critico", IMPORTANTE: "importante", OPORTUNIDADE: "oportunidade", INFORMACAO: "informacao" });

const anomalia = (a) => Object.freeze({ ...a, fontes: a.fontes || [], confianca: a.confianca || "alta" });

/** Faturamento do último dia lançado × mesmo dia da semana nas semanas anteriores. */
export function detectarFaturamento({ historico, hoje, lim }) {
  if (!Array.isArray(historico) || !historico.length) return [];
  const ordenado = [...historico].sort((a, b) => a.data.localeCompare(b.data));
  const ultimo = ordenado[ordenado.length - 1];
  // Só o último dia lançado se for recente (hoje, ontem ou anteontem): um
  // lançamento de semanas atrás não é "a situação de hoje".
  if (!ultimo || ultimo.data < somarDias(hoje, -2)) return [];
  const dow = diaDaSemana(ultimo.data);
  const comparaveis = ordenado.filter((l) => l.data < ultimo.data && diaDaSemana(l.data) === dow).slice(-6);
  const b = compararComBaseline(ultimo.receita, comparaveis.map((l) => l.receita), { minAmostras: lim.minAmostras });
  const base = {
    modulo: "vendas", entidade: { tipo: "dia", id: ultimo.data, nome: ddmm(ultimo.data) },
    dados: { data: ultimo.data, diaSemana: nomeDiaSemana(ultimo.data), atual: ultimo.receita, baseline: b, amostras: comparaveis.map((l) => ({ data: l.data, receita: l.receita })) },
    fontes: [{ tabela: "fin_faturamento_diario" }], periodo: { de: ultimo.data, ate: ultimo.data },
  };
  if (desvioRelevante(b, { pctMin: lim.faturamentoQuedaPct, zMin: lim.faturamentoZ, direcao: "queda" })) {
    return [anomalia({ ...base, tipo: "faturamento_queda", chave: ultimo.data, severidade: SEVERIDADE.IMPORTANTE })];
  }
  if (desvioRelevante(b, { pctMin: lim.faturamentoAltaPct, zMin: lim.faturamentoZ, direcao: "alta" })) {
    return [anomalia({ ...base, tipo: "faturamento_alta", chave: ultimo.data, severidade: SEVERIDADE.OPORTUNIDADE })];
  }
  return [];
}

/** Dias sem faturamento lançado na última semana: furo que impede CMV % e DRE. */
export function detectarFurosDeFaturamento({ faturamento7d }) {
  if (!faturamento7d || faturamento7d.status !== "parcial") return [];
  const faltando = (faturamento7d.detalhes?.faltando || []).filter((d) => d < faturamento7d.periodo.ate);
  if (!faltando.length) return [];
  return [anomalia({
    tipo: "faturamento_dias_faltando", chave: faltando.join(","), severidade: SEVERIDADE.INFORMACAO, modulo: "financeiro",
    entidade: { tipo: "periodo", id: faturamento7d.periodo.de, nome: faturamento7d.periodo.rotulo },
    dados: { faltando }, fontes: faturamento7d.fontes, periodo: faturamento7d.periodo, confianca: "alta",
  })];
}

/** Compras desta semana × as 4 janelas equivalentes anteriores. */
export function detectarCompras({ compras, lim }) {
  if (!temValor(compras)) return [];
  const janelas = compras.detalhes?.janelasAnteriores || [];
  const b = compararComBaseline(compras.valor, janelas.map((j) => j.valor), { minAmostras: lim.minAmostras });
  if (!b.suficiente || !(b.media > 0)) return [];
  if (!desvioRelevante(b, { pctMin: lim.comprasAltaPct, zMin: 1, direcao: "alta" })) return [];
  return [anomalia({
    tipo: "compras_alta", chave: compras.periodo.de, severidade: SEVERIDADE.IMPORTANTE, modulo: "compras",
    entidade: { tipo: "periodo", id: compras.periodo.de, nome: compras.periodo.rotulo },
    dados: { atual: compras.valor, baseline: b, janelas, itens: (compras.detalhes?.itens || []).slice(0, 3) },
    fontes: compras.fontes, periodo: compras.periodo,
  })];
}

/** Preço da última compra × média das anteriores do mesmo produto. */
export function detectarPrecos({ precos, lim }) {
  if (!temValor(precos)) return [];
  const out = [];
  for (const p of precos.detalhes?.aumentos || []) {
    const pct = p.pctSobreMedia ?? p.pct;
    if (pct >= lim.precoVariacaoPct) {
      out.push(anomalia({
        tipo: "preco_alta", chave: `${p.insumo_id}:${p.dataAtual}`, severidade: SEVERIDADE.IMPORTANTE, modulo: "compras",
        entidade: { tipo: "produto", id: p.insumo_id, nome: p.nome }, dados: { ...p, pctReferencia: pct },
        fontes: precos.fontes, periodo: { de: p.dataAnterior, ate: p.dataAtual },
      }));
    }
  }
  for (const p of precos.detalhes?.quedas || []) {
    const pct = p.pctSobreMedia ?? p.pct;
    if (pct <= -lim.precoVariacaoPct) {
      out.push(anomalia({
        tipo: "preco_queda", chave: `${p.insumo_id}:${p.dataAtual}`, severidade: SEVERIDADE.OPORTUNIDADE, modulo: "compras",
        entidade: { tipo: "produto", id: p.insumo_id, nome: p.nome }, dados: { ...p, pctReferencia: pct },
        fontes: precos.fontes, periodo: { de: p.dataAnterior, ate: p.dataAtual },
      }));
    }
  }
  return out.slice(0, 5);
}

/** Vencidos ainda com saldo (crítico) e vencendo nos próximos dias (importante). */
export function detectarValidade({ vencimentos }) {
  if (!temValor(vencimentos)) return [];
  const out = [];
  const venc = vencimentos.detalhes?.vencidos || [];
  if (venc.length) {
    out.push(anomalia({
      tipo: "produto_vencido", chave: venc.map((v) => `${v.insumo_id}:${v.validade}`).join("|").slice(0, 200), severidade: SEVERIDADE.CRITICO, modulo: "estoque",
      entidade: { tipo: "produto", id: venc[0].insumo_id, nome: venc[0].produto }, dados: { lotes: venc },
      fontes: vencimentos.fontes, periodo: vencimentos.periodo, confianca: vencimentos.confianca,
    }));
  }
  const prox = vencimentos.detalhes?.aVencer || [];
  if (prox.length) {
    out.push(anomalia({
      tipo: "produto_vencendo", chave: prox.map((v) => `${v.insumo_id}:${v.validade}`).join("|").slice(0, 200), severidade: SEVERIDADE.IMPORTANTE, modulo: "estoque",
      entidade: { tipo: "produto", id: prox[0].insumo_id, nome: prox[0].produto }, dados: { lotes: prox },
      fontes: vencimentos.fontes, periodo: vencimentos.periodo, confianca: vencimentos.confianca,
    }));
  }
  return out;
}

/** Contado × esperado no último inventário; saldo × lotes (integridade). */
export function detectarDivergencias({ divergencias, lim }) {
  if (!temValor(divergencias)) return [];
  const out = [];
  const inv = divergencias.detalhes?.inventario;
  for (const d of (divergencias.detalhes?.contagem || []).slice(0, 3)) {
    if (d.pct != null && Math.abs(d.pct) < lim.contagemDivergenciaPct) continue;
    out.push(anomalia({
      tipo: d.diferenca < 0 ? "contagem_falta" : "contagem_sobra", chave: `${inv?.id}:${d.insumo_id}`,
      severidade: d.pct == null || Math.abs(d.pct) >= lim.contagemCriticaPct ? SEVERIDADE.CRITICO : SEVERIDADE.IMPORTANTE, modulo: "estoque",
      entidade: { tipo: "produto", id: d.insumo_id, nome: d.produto }, dados: { ...d, inventario: inv },
      fontes: divergencias.fontes, periodo: inv ? { de: inv.data, ate: inv.data } : divergencias.periodo,
    }));
  }
  const integ = divergencias.detalhes?.integridade || [];
  if (integ.length) {
    out.push(anomalia({
      tipo: "saldo_lotes_divergente", chave: integ.map((i) => i.insumo_id).join("|").slice(0, 200), severidade: SEVERIDADE.INFORMACAO, modulo: "estoque",
      entidade: { tipo: "produto", id: integ[0].insumo_id, nome: integ[0].produto }, dados: { itens: integ, total: divergencias.detalhes.totalIntegridade },
      fontes: divergencias.fontes, periodo: divergencias.periodo,
    }));
  }
  return out;
}

export function detectarMinimo({ abaixoMinimo }) {
  if (!temValor(abaixoMinimo) || !abaixoMinimo.valor) return [];
  return [anomalia({
    tipo: "estoque_abaixo_minimo", chave: abaixoMinimo.detalhes.lista.map((i) => i.insumo_id).join("|").slice(0, 200), severidade: SEVERIDADE.IMPORTANTE, modulo: "estoque",
    entidade: { tipo: "produto", id: abaixoMinimo.detalhes.lista[0]?.insumo_id, nome: abaixoMinimo.detalhes.lista[0]?.produto },
    dados: { itens: abaixoMinimo.detalhes.lista, total: abaixoMinimo.valor }, fontes: abaixoMinimo.fontes, periodo: abaixoMinimo.periodo,
  })];
}

/** Perdas desta semana × as 4 janelas equivalentes anteriores. */
export function detectarPerdas({ perdas, lim }) {
  if (!temValor(perdas) || !(perdas.valor > 0)) return [];
  const janelas = perdas.detalhes?.janelasAnteriores || [];
  const b = compararComBaseline(perdas.valor, janelas.map((j) => j.valor), { minAmostras: lim.minAmostras });
  if (!b.suficiente || !(b.media > 0) || !desvioRelevante(b, { pctMin: lim.perdasAltaPct, zMin: 1, direcao: "alta" })) return [];
  return [anomalia({
    tipo: "perdas_alta", chave: perdas.periodo.de, severidade: SEVERIDADE.IMPORTANTE, modulo: "estoque",
    entidade: { tipo: "periodo", id: perdas.periodo.de, nome: perdas.periodo.rotulo }, dados: { atual: perdas.valor, baseline: b, porProduto: (perdas.detalhes?.porProduto || []).slice(0, 3) },
    fontes: perdas.fontes, periodo: perdas.periodo, confianca: perdas.confianca,
  })];
}

export function detectarContas({ contas }) {
  if (!temValor(contas)) return [];
  const d = contas.detalhes;
  const out = [];
  if (d.vencidas.qtd) out.push(anomalia({ tipo: "contas_vencidas", chave: d.vencidas.lista.map((c) => c.id).join("|").slice(0, 200), severidade: SEVERIDADE.CRITICO, modulo: "financeiro", entidade: { tipo: "conta_pagar", id: d.vencidas.lista[0].id, nome: d.vencidas.lista[0].descricao }, dados: d.vencidas, fontes: contas.fontes, periodo: contas.periodo }));
  if (d.hoje.qtd) out.push(anomalia({ tipo: "contas_hoje", chave: d.hoje.lista.map((c) => c.id).join("|").slice(0, 200), severidade: SEVERIDADE.IMPORTANTE, modulo: "financeiro", entidade: { tipo: "conta_pagar", id: d.hoje.lista[0].id, nome: d.hoje.lista[0].descricao }, dados: d.hoje, fontes: contas.fontes, periodo: contas.periodo }));
  return out;
}

/** CMV % do último período apurado × anterior e × média própria. */
export function detectarCmv({ cmv, lim }) {
  if (!temValor(cmv) || cmv.unidade !== "%") return [];
  const media = cmv.detalhes?.mediaHistorica;
  const vsAnterior = cmv.comparacao?.diferenca;
  const vsMedia = media ? Math.round((cmv.valor - media.valor) * 100) / 100 : null;
  const ref = vsMedia ?? vsAnterior;
  if (ref == null || ref < lim.cmvAltaPontos) return [];
  return [anomalia({
    tipo: "cmv_alta", chave: cmv.periodo.de, severidade: SEVERIDADE.IMPORTANTE, modulo: "financeiro",
    entidade: { tipo: "periodo", id: cmv.periodo.de, nome: cmv.periodo.rotulo },
    dados: { atual: cmv.valor, anterior: cmv.comparacao?.valor ?? null, vsAnterior, media: media?.valor ?? null, periodosMedia: media?.periodos ?? null, vsMedia, contribuicoes: cmv.detalhes?.contribuicoes, alertas: cmv.detalhes?.alertas || [] },
    fontes: cmv.fontes, periodo: cmv.periodo,
  })];
}

/** Roda todos os detectores sobre as métricas disponíveis. */
export function detectarTudo(dados, lim) {
  return [
    ...detectarValidade(dados),
    ...detectarDivergencias({ ...dados, lim }),
    ...detectarContas(dados),
    ...detectarFaturamento({ ...dados, lim }),
    ...detectarCmv({ ...dados, lim }),
    ...detectarPrecos({ ...dados, lim }),
    ...detectarCompras({ ...dados, lim }),
    ...detectarPerdas({ ...dados, lim }),
    ...detectarMinimo(dados),
    ...detectarFurosDeFaturamento(dados),
  ];
}
