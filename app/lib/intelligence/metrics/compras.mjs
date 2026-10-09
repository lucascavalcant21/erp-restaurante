// COMPRAS e PREÇOS — fonte: compras confirmadas (vw_compras + compras_itens),
// as mesmas do custo médio e do CMV real. Data da compra = data de entrada
// (recebimento, ou a da compra), regra de cmv-real.mjs. Rascunho e cancelada
// não entram. Preço por unidade base (kg, L, un), sem frete.

import { metrica, insuficiente, CONFIANCA } from "../core/contratos.mjs";
import { somarDias, periodoAnterior, ddmm } from "../core/periodos.mjs";
import { ler } from "../context/db-escopado.mjs";
import { comprasDaJanela, variacoesPreco, rotuloBase } from "../../cmv-real.mjs";
import { medir, r2, r3, soma, fonte } from "./base.mjs";

// vw_compras no banco real não tem data_recebimento: a data de entrada é a data da compra
const COLUNAS_COMPRA = "id, data_compra, status, valor_total, valor_itens, fornecedor_id, confirmada_em, created_at";
const COLUNAS_ITEM = "id, compra_id, insumo_id, descricao_snapshot, quantidade_embalagens, conteudo_por_embalagem, quantidade_base, unidade_base, valor_total";
const dataEntrada = (c) => String(c.data_recebimento || c.data_compra).slice(0, 10);

/** Compras com entrada em [de, ate] + itens + nomes. Busca a partir de `de − folga` pela data da compra. */
export async function lerCompras(amb, de, ate, { folgaDias = 60 } = {}) {
  const compras = (await ler(amb.dbe.from("vw_compras").select(COLUNAS_COMPRA).gte("data_compra", somarDias(de, -folgaDias)).lte("data_compra", ate), "vw_compras") || [])
    .map((c) => ({ ...c, data_compra: String(c.data_compra).slice(0, 10), data_recebimento: c.data_recebimento ? String(c.data_recebimento).slice(0, 10) : null, valor_total: Number(c.valor_total), valor_itens: Number(c.valor_itens) }))
    .filter((c) => { const d = dataEntrada(c); return d >= de && d <= ate; });
  const ids = compras.filter((c) => c.status === "confirmada").map((c) => c.id);
  const itens = ids.length ? (await ler(amb.dbe.from("compras_itens").select(COLUNAS_ITEM).in("compra_id", ids), "compras_itens") || []) : [];
  return { compras, itens };
}

async function nomes(amb, tabela, ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return new Map();
  const linhas = await ler(amb.dbe.from(tabela).select("id, nome").in("id", lista), tabela);
  return new Map((linhas || []).map((l) => [l.id, l.nome]));
}

export function compras(amb, periodo, { comparar = true } = {}) {
  return medir(amb, { id: "compras", capacidade: "compras", periodo }, async (consultas) => {
    const anterior = comparar ? periodoAnterior(periodo) : null;
    // uma leitura só cobre o período, o anterior e os 90 dias de "o módulo é usado?"
    const deLeitura = somarDias(periodo.de, -90);
    const { compras: todas, itens } = await lerCompras(amb, deLeitura, periodo.ate);
    const fontes = [fonte("vw_compras", "Compras confirmadas (total com frete e desconto)"), fonte("compras_itens", "Itens das compras")];

    if (!todas.length) {
      return insuficiente({
        metrica: "compras", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Não há nenhuma compra registrada no Héfisto nos últimos 90 dias. Se as compras são lançadas fora do sistema, não consigo somá-las.`,
        faltando: ["registro de compras (Operacional → Compras e Custo Médio)"],
      });
    }

    const ateExcl = somarDias(periodo.ate, 1);
    const janela = comprasDaJanela(todas, itens, periodo.de, ateExcl);
    const total = r2(soma(janela.confirmadas, (c) => c.valor_total));
    const insumos = await nomes(amb, "insumos", janela.itens.map((i) => i.insumo_id));
    const fornecedores = await nomes(amb, "fornecedores", janela.confirmadas.map((c) => c.fornecedor_id));

    const porInsumo = new Map();
    for (const i of janela.itens) {
      const k = `${i.insumo_id}|${i.unidade_base}`;
      const a = porInsumo.get(k) || { insumo_id: i.insumo_id, nome: insumos.get(i.insumo_id) || i.descricao_snapshot || "(produto)", unidade: rotuloBase(i.unidade_base), base: i.unidade_base, quantidade: 0, valor: 0 };
      a.quantidade += Number(i.quantidade_base) || 0;
      a.valor += Number(i.valor_rateado) || 0;
      porInsumo.set(k, a);
    }
    const fator = { g: 1000, ml: 1000, un: 1 };
    const itensResumo = [...porInsumo.values()]
      .map((p) => ({ ...p, quantidade: r3(p.quantidade / (fator[p.base] || 1)), valor: r2(p.valor) }))
      .sort((a, b) => b.valor - a.valor);
    const porFornecedor = new Map();
    for (const c of janela.confirmadas) {
      const k = c.fornecedor_id || "-";
      const a = porFornecedor.get(k) || { nome: fornecedores.get(c.fornecedor_id) || "Fornecedor não informado", valor: 0, compras: 0 };
      a.valor = r2(a.valor + c.valor_total); a.compras += 1; porFornecedor.set(k, a);
    }

    const observacoes = [];
    if (janela.rascunhos.length) observacoes.push(`${janela.rascunhos.length} compra(s) em rascunho no período não entraram (só confirmadas contam).`);
    if (!janela.confirmadas.length) observacoes.push("Nenhuma compra confirmada no período. Se houve compra fora do Héfisto, ela não aparece aqui.");

    let comparacao = null;
    if (anterior) {
      const ja = comprasDaJanela(todas, itens, anterior.de, somarDias(anterior.ate, 1));
      const totAnt = r2(soma(ja.confirmadas, (c) => c.valor_total));
      if (totAnt > 0) {
        comparacao = { periodo: { de: anterior.de, ate: anterior.ate, rotulo: anterior.rotulo }, valor: totAnt, diferenca: r2(total - totAnt), diferencaPct: r2(((total - totAnt) / totAnt) * 100) };
      } else {
        observacoes.push(`Sem compras confirmadas em ${anterior.rotulo} para comparar.`);
      }
    }

    // Baseline próprio: as 4 janelas equivalentes anteriores (mesmos dias da
    // semana), para o detector comparar "esta semana × semanas anteriores".
    const janelasAnteriores = [1, 2, 3, 4].map((k) => {
      const de = somarDias(periodo.de, -7 * k); const ate = somarDias(periodo.ate, -7 * k);
      const j = comprasDaJanela(todas, itens, de, somarDias(ate, 1));
      return { de, ate, valor: r2(soma(j.confirmadas, (c) => c.valor_total)) };
    });

    return metrica({
      metrica: "compras", valor: total, unidade: "BRL",
      periodo: { de: periodo.de, ate: periodo.ate, rotulo: periodo.rotulo },
      comparacao, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: 1,
      // o que não foi lançado no Héfisto não tem como aparecer
      confianca: janela.confirmadas.length ? CONFIANCA.ALTA : CONFIANCA.MEDIA,
      apuradoEm: amb.apuradoEm, observacoes,
      detalhes: {
        quantidadeCompras: janela.confirmadas.length, rascunhos: janela.rascunhos.length, canceladas: janela.canceladas.length, janelasAnteriores,
        itens: itensResumo.slice(0, 15), fornecedores: [...porFornecedor.values()].sort((a, b) => b.valor - a.valor).slice(0, 8),
      },
    });
  });
}

/**
 * Variação de preço por produto: última compra confirmada × compra anterior
 * do mesmo produto (variacoesPreco do CMV real) e × média das anteriores.
 */
export function variacoesDePreco(amb, { janelaDias = 120 } = {}) {
  const periodo = { de: somarDias(amb.hoje, -janelaDias), ate: amb.hoje, rotulo: `compras dos últimos ${janelaDias} dias` };
  return medir(amb, { id: "variacao_preco", capacidade: "precos_compra", periodo }, async (consultas) => {
    const { compras: todas, itens } = await lerCompras(amb, periodo.de, periodo.ate, { folgaDias: 30 });
    const fontes = [fonte("vw_compras", "Compras confirmadas"), fonte("compras_itens", "Preço do item por unidade base, sem frete")];
    const vs = variacoesPreco(todas, itens).filter((v) => v.anterior && v.pct != null);
    if (!vs.length) {
      return insuficiente({
        metrica: "variacao_preco", periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, fontes, consultas: consultas(),
        motivo: `Nenhum produto tem pelo menos duas compras confirmadas nos últimos ${janelaDias} dias para comparar preço.`,
        faltando: ["duas ou mais compras confirmadas do mesmo produto"],
      });
    }
    const insumos = await nomes(amb, "insumos", vs.map((v) => v.insumo_id));
    const fornecedores = await nomes(amb, "fornecedores", vs.flatMap((v) => [v.atual.fornecedor_id, v.anterior.fornecedor_id]));
    const lista = vs.map((v) => {
      const anteriores = v.historico.slice(0, -1);
      const media = anteriores.length ? anteriores.reduce((t, x) => t + x.preco, 0) / anteriores.length : null;
      return {
        insumo_id: v.insumo_id, nome: insumos.get(v.insumo_id) || "(produto)", unidade: rotuloBase(v.unidade_base),
        precoAnterior: r2(v.anterior.preco), dataAnterior: v.anterior.data, fornecedorAnterior: fornecedores.get(v.anterior.fornecedor_id) || null,
        precoAtual: r2(v.atual.preco), dataAtual: v.atual.data, fornecedorAtual: fornecedores.get(v.atual.fornecedor_id) || null,
        diferenca: v.diferenca, pct: v.pct,
        mediaAnteriores: media != null ? r2(media) : null, comprasAnteriores: anteriores.length,
        pctSobreMedia: media ? r2(((v.atual.preco - media) / media) * 100) : null,
      };
    }).sort((a, b) => b.pct - a.pct);
    const maior = lista[0];
    return metrica({
      metrica: "variacao_preco", valor: maior.pct, unidade: "%",
      periodo, fontes, consultas: consultas(), escopo: amb.escopo,
      completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: amb.apuradoEm,
      observacoes: [`Compara a última compra de cada produto com a compra anterior do mesmo produto (${lista.length} produto(s) com histórico). Última compra de ${maior.nome} em ${ddmm(maior.dataAtual)}.`],
      detalhes: { maior, aumentos: lista.filter((x) => x.pct > 0).slice(0, 10), quedas: lista.filter((x) => x.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5) },
    });
  });
}
