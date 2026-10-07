// ESTOQUE — saldo, validade, divergências e perdas, lidos das mesmas tabelas
// que a tela de estoque usa (EST-MOV-1): estoque_itens (saldo), estoque_lotes
// (validade/FEFO), estoque_contagens(+_itens) (contado × sistema, custo
// congelado), estoque_movimentacoes_multi (histórico imutável), estoque_custos
// (custo médio). Quantidade sempre na unidade do SALDO (unidadeDoSaldo).

import { metrica, insuficiente, CONFIANCA, NATUREZA, confiancaPorCompletude } from "../core/contratos.mjs";
import { somarDias, ddmm, limitesUtc, diasEntre } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { exibirQtd, rotuloBase } from "../../cmv-real.mjs";
import { CAMPOS_INSUMO, candidatosDoTermo, custoPorUnidadeDoSaldo, unidadeDoSaldo, normalizar } from "./produtos.mjs";
import { medir, r2, r3, soma, fonte } from "./base.mjs";

async function mapaInsumos(amb, ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return new Map();
  const linhas = await ler(amb.dbe.from("insumos").select(CAMPOS_INSUMO).in("id", lista), "insumos");
  return new Map((linhas || []).map((i) => [i.id, i]));
}

async function mapaEstoques(amb) {
  const linhas = await ler(amb.dbe.from("estoques").select("id, nome, status"), "estoques");
  return new Map((linhas || []).map((e) => [e.id, e]));
}

async function custosMedios(amb, ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return new Map();
  try {
    const linhas = await ler(amb.dbe.from("estoque_custos").select("insumo_id, custo_medio_base").in("insumo_id", lista), "estoque_custos");
    return new Map((linhas || []).map((c) => [c.insumo_id, Number(c.custo_medio_base)]));
  } catch (e) {
    if (e.ausente) return new Map();
    throw e;
  }
}

// ─── Saldo de um produto ─────────────────────────────────────────────────────
/**
 * "Quanto tenho de picanha?" → resolve no cadastro da unidade; com mais de um
 * candidato, devolve a lista para o usuário escolher (nada de chutar).
 * @returns {Promise<{ tipo: "metrica"|"ambiguo"|"nao_encontrado", ... }>}
 */
export async function saldoDoProduto(amb, { termo = null, insumoId = null } = {}) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: `agora (${ddmm(amb.hoje)})` };
  return medir(amb, { id: "saldo_produto", capacidade: "saldo_estoque", periodo }, async (consultas) => {
    const insumos = await ler(amb.dbe.from("insumos").select(CAMPOS_INSUMO).order("nome"), "insumos") || [];
    const candidatos = insumoId ? insumos.filter((i) => i.id === insumoId) : candidatosDoTermo(insumos, termo);
    if (!candidatos.length) {
      return insuficiente({ metrica: "saldo_produto", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(),
        motivo: `Não encontrei "${String(termo || "").slice(0, 60)}" no cadastro de produtos desta unidade.`, faltando: ["produto no cadastro"], detalhes: { naoEncontrado: true } });
    }
    if (candidatos.length > 1) {
      return insuficiente({ metrica: "saldo_produto", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(),
        motivo: "Encontrei mais de um produto com esse nome. Qual deles?", faltando: ["escolher o produto"],
        detalhes: { ambiguo: true, opcoes: candidatos.map((c) => ({ id: c.id, nome: c.nome, unidade: c.unidade_medida })) } });
    }
    const insumo = candidatos[0];
    const itens = await ler(amb.dbe.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual, estoque_minimo, validade").eq("insumo_id", insumo.id), "estoque_itens") || [];
    const estoques = await mapaEstoques(amb);
    const custo = (await custosMedios(amb, [insumo.id])).get(insumo.id);
    const un = unidadeDoSaldo(insumo);
    const locais = itens.filter((i) => estoques.get(i.estoque_id)?.status !== "inativo").map((i) => ({
      estoqueId: i.estoque_id, local: estoques.get(i.estoque_id)?.nome || "Estoque", quantidade: r3(Number(i.quantidade_atual) || 0),
      minimo: i.estoque_minimo != null ? Number(i.estoque_minimo) : null, validadeMaisProxima: i.validade || null,
    }));
    const total = r3(soma(locais, (l) => l.quantidade));
    const cu = custo != null ? custoPorUnidadeDoSaldo(custo, insumo) : null;
    const observacoes = [];
    if (!locais.length) observacoes.push(`${insumo.nome} está no cadastro mas não está vinculado a nenhum local de estoque.`);
    return metrica({
      metrica: "saldo_produto", valor: total, unidade: un,
      periodo, fontes: [fonte("estoque_itens", "Saldo atual por local"), fonte("insumos", "Cadastro do produto")],
      consultas: consultas(), escopo: amb.escopo, completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm, observacoes,
      detalhes: {
        produto: { id: insumo.id, nome: insumo.nome }, locais,
        valorAoCustoMedio: cu != null ? { valor: r2(total * cu), natureza: NATUREZA.ESTIMATIVA, base: "custo médio vigente" } : null,
      },
    });
  });
}

// ─── Validade ────────────────────────────────────────────────────────────────
/** Lotes com saldo vencidos ou vencendo até hoje + `dias`; etiquetas ativas no mesmo prazo. */
export function vencimentos(amb, { dias = 3 } = {}) {
  const limite = somarDias(amb.hoje, dias);
  const periodo = { de: amb.hoje, ate: limite, rotulo: `até ${ddmm(limite)} (próximos ${dias} dias)` };
  return medir(amb, { id: "vencimentos", capacidade: "validade", periodo }, async (consultas) => {
    const lotes = await ler(amb.dbe.from("estoque_lotes").select("estoque_id, insumo_id, validade, quantidade").gt("quantidade", 0), "estoque_lotes") || [];
    const comValidade = lotes.filter((l) => l.validade);
    const semValidade = lotes.length - comValidade.length;
    if (lotes.length && !comValidade.length) {
      return insuficiente({ metrica: "vencimentos", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(),
        motivo: `Nenhum dos ${lotes.length} lote(s) com saldo tem validade informada: não há como saber o que vence.`, faltando: ["validade nas entradas de estoque"] });
    }
    const alvo = comValidade.filter((l) => String(l.validade).slice(0, 10) <= limite);
    const insumos = await mapaInsumos(amb, alvo.map((l) => l.insumo_id));
    const estoques = await mapaEstoques(amb);
    const custos = await custosMedios(amb, alvo.map((l) => l.insumo_id));
    const linhas = alvo.map((l) => {
      const ins = insumos.get(l.insumo_id) || { nome: "(produto)" };
      const validade = String(l.validade).slice(0, 10);
      const q = r3(Number(l.quantidade));
      const cu = custos.has(l.insumo_id) ? custoPorUnidadeDoSaldo(custos.get(l.insumo_id), ins) : null;
      return {
        insumo_id: l.insumo_id, produto: ins.nome, local: estoques.get(l.estoque_id)?.nome || "Estoque", validade,
        diasParaVencer: diasEntre(amb.hoje, validade), vencido: validade < amb.hoje,
        quantidade: q, unidade: unidadeDoSaldo(ins), valorEstimado: cu != null ? r2(q * cu) : null,
      };
    }).sort((a, b) => a.validade.localeCompare(b.validade) || (b.valorEstimado || 0) - (a.valorEstimado || 0));

    let etiquetas = [];
    try {
      const fim = limitesUtc({ de: amb.hoje, ate: limite, fuso: amb.fuso }).fim;
      const et = await ler(amb.dbe.from("etiquetas").select("codigo, produto, validade_em, quantidade, unidade, status").eq("status", "ativa").lt("validade_em", fim).order("validade_em").limit(50), "etiquetas") || [];
      etiquetas = et.map((e) => ({ codigo: e.codigo, produto: e.produto, validade: String(e.validade_em).slice(0, 10), vencido: String(e.validade_em).slice(0, 10) < amb.hoje, quantidade: e.quantidade, unidade: e.unidade }));
    } catch (e) {
      if (!e.ausente) throw e;
    }

    const completude = lotes.length ? comValidade.length / lotes.length : 1;
    const observacoes = [];
    if (semValidade) observacoes.push(`${semValidade} lote(s) com saldo não têm validade informada e não puderam ser avaliados.`);
    const valorTotal = linhas.every((l) => l.valorEstimado != null) ? r2(soma(linhas, (l) => l.valorEstimado)) : null;
    return metrica({
      metrica: "vencimentos", valor: linhas.length, unidade: "lotes",
      periodo, fontes: [fonte("estoque_lotes", "Lotes com saldo por validade (FEFO)"), fonte("etiquetas", "Etiquetas ativas")],
      consultas: consultas(), escopo: amb.escopo, completude: completude || 1, confianca: lotes.length ? confiancaPorCompletude(completude, { minimoMedia: 0.7 }) : CONFIANCA.MEDIA,
      apuradoEm: amb.apuradoEm, observacoes: completude < 1 ? observacoes : observacoes.concat(lotes.length ? [] : ["Nenhum lote com saldo registrado no estoque."]),
      detalhes: {
        vencidos: linhas.filter((l) => l.vencido), aVencer: linhas.filter((l) => !l.vencido), etiquetas,
        valorEstimado: valorTotal != null ? { valor: valorTotal, natureza: NATUREZA.ESTIMATIVA, base: "quantidade × custo médio vigente" } : null,
      },
    });
  });
}

// ─── Divergências ────────────────────────────────────────────────────────────
/**
 * Duas checagens, nenhuma inventada:
 *  1. Último inventário FECHADO: contado × sistema por produto (diferença
 *     gravada pelo banco), valorizada pelo custo congelado na contagem.
 *  2. Integridade: saldo do item × soma dos lotes (devem ser iguais).
 */
export function divergenciasEstoque(amb, { limitePct = 10, maxItens = 10 } = {}) {
  const periodo = { de: somarDias(amb.hoje, -60), ate: amb.hoje, rotulo: "último inventário fechado (até 60 dias)" };
  return medir(amb, { id: "divergencias_estoque", capacidade: "divergencias", periodo }, async (consultas) => {
    const contagens = await ler(amb.dbe.from("estoque_contagens").select("id, tipo, data_referencia, status, estoque_id, fechada_em").eq("status", "fechada").gte("data_referencia", periodo.de).order("fechada_em", { ascending: false }).limit(1), "estoque_contagens") || [];
    const ultima = contagens[0] || null;
    let contagem = [];
    let insumos = new Map();
    if (ultima) {
      const itens = await ler(amb.dbe.from("estoque_contagens_itens").select("insumo_id, estoque_id, quantidade_contada, quantidade_sistema, unidade_base, custo_unitario, diferenca").eq("contagem_id", ultima.id), "estoque_contagens_itens") || [];
      insumos = await mapaInsumos(amb, itens.map((i) => i.insumo_id));
      contagem = itens.filter((i) => i.quantidade_sistema != null && Math.abs(Number(i.diferenca)) > 0.0005).map((i) => {
        const sis = Number(i.quantidade_sistema); const dif = Number(i.diferenca);
        const custo = i.custo_unitario != null ? Number(i.custo_unitario) : null;
        return {
          insumo_id: i.insumo_id, produto: insumos.get(i.insumo_id)?.nome || "(produto)", unidade: rotuloBase(i.unidade_base),
          esperado: exibirQtd(sis, i.unidade_base), contado: exibirQtd(Number(i.quantidade_contada), i.unidade_base), diferenca: exibirQtd(dif, i.unidade_base),
          pct: sis > 0 ? r2((dif / sis) * 100) : null, valor: custo != null ? r2(dif * custo) : null,
        };
      }).filter((d) => d.pct == null || Math.abs(d.pct) >= limitePct)
        .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0));
    }

    const [itensSaldo, lotes] = await Promise.all([
      ler(amb.dbe.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual"), "estoque_itens"),
      ler(amb.dbe.from("estoque_lotes").select("estoque_id, insumo_id, quantidade"), "estoque_lotes"),
    ]);
    const somaLotes = new Map();
    for (const l of lotes || []) { const k = `${l.estoque_id}|${l.insumo_id}`; somaLotes.set(k, (somaLotes.get(k) || 0) + (Number(l.quantidade) || 0)); }
    const semLotes = (lotes || []).length === 0;
    const integridade = semLotes ? [] : (itensSaldo || []).filter((i) => {
      const k = `${i.estoque_id}|${i.insumo_id}`;
      return Math.abs((somaLotes.get(k) || 0) - (Number(i.quantidade_atual) || 0)) > 0.0005;
    });
    const insInt = await mapaInsumos(amb, integridade.map((i) => i.insumo_id));
    const integridadeLista = integridade.slice(0, maxItens).map((i) => ({
      insumo_id: i.insumo_id, produto: insInt.get(i.insumo_id)?.nome || "(produto)", saldo: r3(Number(i.quantidade_atual)), somaDosLotes: r3(somaLotes.get(`${i.estoque_id}|${i.insumo_id}`) || 0),
    }));

    if (!ultima && !(itensSaldo || []).length) {
      return insuficiente({ metrica: "divergencias_estoque", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(),
        motivo: "Não há inventário fechado nos últimos 60 dias nem saldo de estoque para conferir.", faltando: ["inventário fechado (Estoque → Contagem)"] });
    }
    const observacoes = [];
    if (!ultima) observacoes.push("Nenhum inventário fechado nos últimos 60 dias: só foi possível conferir saldo × lotes. Para comparar contado × esperado, feche uma contagem.");
    return metrica({
      metrica: "divergencias_estoque", valor: contagem.length + integridade.length, unidade: "itens",
      periodo, fontes: [fonte("estoque_contagens_itens", "Contado × sistema no inventário fechado"), fonte("estoque_itens", "Saldo"), fonte("estoque_lotes", "Lotes")],
      consultas: consultas(), escopo: amb.escopo, completude: ultima ? 1 : 0.5, confianca: ultima ? CONFIANCA.ALTA : CONFIANCA.BAIXA,
      apuradoEm: amb.apuradoEm, observacoes,
      detalhes: {
        inventario: ultima ? { id: ultima.id, data: String(ultima.data_referencia).slice(0, 10), tipo: ultima.tipo, limitePct } : null,
        contagem: contagem.slice(0, maxItens), totalContagem: contagem.length,
        valorDivergencias: contagem.every((d) => d.valor != null) ? r2(soma(contagem, (d) => d.valor)) : null,
        integridade: integridadeLista, totalIntegridade: integridade.length,
      },
    });
  });
}

// ─── Abaixo do mínimo ────────────────────────────────────────────────────────
/** Mesma regra dos cartões do estoque (painel-inicio.mjs): só item com mínimo > 0 e saldo abaixo dele. */
export function abaixoDoMinimo(amb) {
  const periodo = { de: amb.hoje, ate: amb.hoje, rotulo: `agora (${ddmm(amb.hoje)})` };
  return medir(amb, { id: "abaixo_minimo", capacidade: "saldo_estoque", periodo }, async (consultas) => {
    const itens = await ler(amb.dbe.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual, estoque_minimo"), "estoque_itens") || [];
    const estoques = await mapaEstoques(amb);
    const abaixo = itens.filter((i) => estoques.get(i.estoque_id)?.status !== "inativo" && Number(i.estoque_minimo) > 0 && Number(i.quantidade_atual || 0) < Number(i.estoque_minimo));
    const insumos = await mapaInsumos(amb, abaixo.map((i) => i.insumo_id));
    const comMinimo = itens.filter((i) => Number(i.estoque_minimo) > 0).length;
    return metrica({
      metrica: "abaixo_minimo", valor: abaixo.length, unidade: "itens", periodo,
      fontes: [fonte("estoque_itens", "Saldo × estoque mínimo configurado")], consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: comMinimo ? CONFIANCA.ALTA : CONFIANCA.BAIXA, apuradoEm: amb.apuradoEm,
      observacoes: comMinimo ? [] : ["Nenhum produto tem estoque mínimo configurado: não há como saber o que está acabando."],
      detalhes: {
        itensComMinimo: comMinimo,
        lista: abaixo.map((i) => { const ins = insumos.get(i.insumo_id) || {}; return { insumo_id: i.insumo_id, produto: ins.nome || "(produto)", local: estoques.get(i.estoque_id)?.nome || "Estoque", saldo: r3(Number(i.quantidade_atual) || 0), minimo: Number(i.estoque_minimo), unidade: unidadeDoSaldo(ins) }; })
          .sort((a, b) => a.saldo / a.minimo - b.saldo / b.minimo).slice(0, 15),
      },
    });
  });
}

// ─── Perdas ──────────────────────────────────────────────────────────────────
const MOTIVOS_PERDA = ["perda", "vencimento", "quebra"];

/** Retiradas com motivo de perda no período (estornos descontados), valorizadas pelo custo do movimento. */
export function perdas(amb, periodo) {
  return medir(amb, { id: "perdas", capacidade: "perdas", periodo }, async (consultas) => {
    const { inicio, fim } = limitesUtc({ ...periodo, fuso: amb.fuso });
    // lê 4 semanas antes também: baseline próprio das perdas
    const inicioHist = limitesUtc({ de: somarDias(periodo.de, -28), ate: periodo.ate, fuso: amb.fuso }).inicio;
    const todos = await ler(amb.dbe.from("estoque_movimentacoes_multi").select("id, insumo_id, quantidade, valor_total, motivo, data_movimento, unidade_medida").eq("tipo", "saida").in("motivo", MOTIVOS_PERDA).gte("data_movimento", inicioHist).lt("data_movimento", fim), "estoque_movimentacoes_multi") || [];
    const estornos = todos.length ? (await ler(amb.dbe.from("estoque_movimentacoes_multi").select("estorno_de_id").in("estorno_de_id", todos.map((m) => m.id)), "estoque_movimentacoes_multi") || []) : [];
    const estornados = new Set(estornos.map((e) => e.estorno_de_id));
    const naJanela = (m, a, b) => { const t = Date.parse(m.data_movimento); return t >= Date.parse(a) && t < Date.parse(b); };
    const movs = todos.filter((m) => naJanela(m, inicio, fim));
    const validos = movs.filter((m) => !estornados.has(m.id));
    const janelasAnteriores = [1, 2, 3, 4].map((k) => {
      const de = somarDias(periodo.de, -7 * k); const ate = somarDias(periodo.ate, -7 * k);
      const l = limitesUtc({ de, ate, fuso: amb.fuso });
      const xs = todos.filter((m) => !estornados.has(m.id) && naJanela(m, l.inicio, l.fim) && m.valor_total != null);
      return { de, ate, valor: r2(soma(xs, (m) => m.valor_total)) };
    });
    const insumos = await mapaInsumos(amb, validos.map((m) => m.insumo_id));
    const comValor = validos.filter((m) => m.valor_total != null);
    const porProduto = new Map();
    for (const m of validos) {
      const a = porProduto.get(m.insumo_id) || { produto: insumos.get(m.insumo_id)?.nome || "(produto)", quantidade: 0, unidade: m.unidade_medida || "", valor: 0, semValor: 0, motivos: new Set() };
      a.quantidade += Number(m.quantidade) || 0;
      if (m.valor_total != null) a.valor += Number(m.valor_total); else a.semValor += 1;
      a.motivos.add(m.motivo);
      porProduto.set(m.insumo_id, a);
    }
    const lista = [...porProduto.values()].map((p) => ({ ...p, quantidade: r3(p.quantidade), valor: r2(p.valor), motivos: [...p.motivos] })).sort((a, b) => b.valor - a.valor);
    if (validos.length && !comValor.length) {
      return insuficiente({ metrica: "perdas", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(),
        motivo: `${validos.length} perda(s) lançada(s), mas nenhuma tinha custo médio no momento do lançamento: não há como dar o valor.`,
        faltando: ["custo médio dos produtos (vem da confirmação de compras)"], detalhes: { lancamentos: validos.length, porProduto: lista.slice(0, 10) } });
    }
    const completude = validos.length ? comValor.length / validos.length : 1;
    const observacoes = [];
    if (validos.length && completude < 1) observacoes.push(`${validos.length - comValor.length} perda(s) sem custo médio no momento do lançamento não entraram no valor.`);
    if (!validos.length) observacoes.push("Nenhuma perda lançada no período. Perda não registrada não aparece aqui.");
    return metrica({
      metrica: "perdas", valor: r2(soma(comValor, (m) => m.valor_total)), unidade: "BRL",
      periodo: { de: periodo.de, ate: periodo.ate, rotulo: periodo.rotulo },
      fontes: [fonte("estoque_movimentacoes_multi", "Retiradas com motivo perda/vencimento/quebra, custo do movimento")],
      consultas: consultas(), escopo: amb.escopo, completude: completude || 1,
      confianca: validos.length ? confiancaPorCompletude(completude) : CONFIANCA.MEDIA, apuradoEm: amb.apuradoEm, observacoes,
      detalhes: { lancamentos: validos.length, estornados: movs.length - validos.length, porProduto: lista.slice(0, 10), janelasAnteriores },
    });
  });
}

export { normalizar };
