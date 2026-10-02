// Resumo financeiro de uma ficha — FONTE ÚNICA do card de Fichas Técnicas
// (fechado e aberto) e da pizza do prato. Funções puras, sem Supabase e sem
// React (testes em ficha-financeiro.test.mjs).
//
// Não cria fórmula nova: junta as que o ERP já tem.
//   custo da receita ......... custoDeProduzirFicha (ficha-calculos)
//   porções .................. porcoesParaCusto (ficha-calculos)
//   preço, taxa, imposto,
//   embalagem, meta de CMV ... entradasFinanceirasDaFicha (ficha-calculos)
//   perda do ingrediente ..... custo-rendimento.mjs
//   composição do preço ...... composicaoDoPreco (composicao-preco.mjs), com
//                              os parâmetros de Financeiro → Pizza do Lucro
//
//   CMV R$  = custo da receita ÷ porções + embalagem por porção
//   CMV %   = CMV R$ ÷ preço × 100
//   (o resto da hierarquia — variáveis, margem de contribuição, CMO,
//    operacionais, pró-labore, resultado e meta — está em composicao-preco.mjs)

import {
  parseNumero, custoDeProduzirFicha, porcoesParaCusto, produtoDaFicha,
  entradasFinanceirasDaFicha, tipoDaFicha,
} from "./ficha-calculos.mjs";
import { custoDoInsumo, fatorCorrecaoDoItem } from "./custo-rendimento.mjs";
import { composicaoDoPreco } from "./composicao-preco.mjs";
import { precoSugerido as precoParaMetaDeLucro } from "./pizza-do-prato.mjs";
import { percentualDe } from "./valor-percentual.mjs";

// A composição do preço (CMV, despesas variáveis, margem de contribuição, CMO,
// despesas operacionais, pró-labore e resultado) mora em composicao-preco.mjs.
export { composicaoDoPreco } from "./composicao-preco.mjs";

// ─── Composição do custo da ficha (linha a linha) ───────────────────────────

// Cada linha da receita com quantidade, custo unitário usado e custo na
// ficha. O custo na ficha sai de custoDeProduzirFicha aplicada à linha
// sozinha — a soma das linhas é o custo da receita, sem segunda conta.
export function linhasDeCustoDaFicha(ficha = {}, fichas = []) {
  const linhas = [];
  for (const [i, fi] of (ficha.fichas_ingredientes || []).entries()) {
    const custo = custoDeProduzirFicha({ id: `${ficha.id}::linha-${i}`, fichas_ingredientes: [fi] }, fichas);
    if (fi.insumos) {
      const ins = fi.insumos;
      const c = custoDoInsumo(ins);
      const fc = fatorCorrecaoDoItem(ins, fi.fator_correcao);
      const perdaPct = ins.empanado ? 0 : c.perdaPct;
      linhas.push({
        tipo: "insumo",
        nome: ins.nome || "Ingrediente",
        quantidade: parseNumero(fi.quantidade),
        unidade: String(fi.unidade || ins.unidade_medida || "un").toLowerCase(),
        unidadeBase: c.unidadeBase,
        custoUnitario: ins.empanado ? c.custoEfetivo : c.custoCompra * (1 + fc / 100),
        custoCompra: c.custoCompra,
        perdaPct: perdaPct > 0 ? perdaPct : (fc > 0 ? null : 0),
        fatorFicha: !(perdaPct > 0) && fc > 0 ? fc : 0,
        quantidadeBruta: parseNumero(fi.quantidade) * (1 + fc / 100),
        empanado: !!ins.empanado,
        custo,
      });
    } else if (fi.subficha_id) {
      const base = fichas.find(x => x.id === fi.subficha_id);
      const rend = parseNumero(base?.rendimento_porcoes) || 1;
      linhas.push({
        tipo: "preparo",
        nome: base?.nome_receita || "Pré-preparo removido",
        quantidade: parseNumero(fi.quantidade),
        unidade: String(fi.unidade || base?.rendimento_unidade || "un").toLowerCase(),
        unidadeBase: String(base?.rendimento_unidade || "un").toLowerCase(),
        custoUnitario: base ? custoDeProduzirFicha(base, fichas) / rend : 0,
        custo,
      });
    }
  }
  const emb = parseNumero(ficha.custo_embalagens_total);
  if (emb > 0) linhas.push({ tipo: "embalagem", nome: "Embalagens do produto", custo: emb });
  return linhas;
}

// ─── Status ─────────────────────────────────────────────────────────────────

// O mesmo critério que o card sempre usou: CMV acima da meta da ficha
// (cmv_meta, padrão 30%) é "CMV Alto". Não há faixas intermediárias no
// sistema, e não se inventam.
export function statusDaFicha(ficha = {}, cmvPct = null, meta = 30) {
  const s = String(ficha.status || "ativa").toLowerCase();
  if (s === "inativa") return { id: "inativa", rotulo: "Inativa" };
  if (s === "rascunho") return { id: "rascunho", rotulo: "Rascunho" };
  if (cmvPct !== null && cmvPct > meta) return { id: "cmv_alto", rotulo: "CMV Alto" };
  return { id: "ativa", rotulo: "Ativa" };
}

// ─── Depois de salvar ───────────────────────────────────────────────────────

// Lista de produtos com o preço que ACABOU de ser gravado no Cardápio. É o
// que a tela de fichas aplica no estado logo depois do salvarProduto dar
// certo: o card mostra o preço novo na hora, e a releitura do banco que vem
// em seguida só confirma. Não muda nada além do preço (e do vínculo).
export function produtosComPrecoSalvo(lista = [], { produtoId = null, fichaId, nome = "", preco }) {
  const casa = (p) => (produtoId && p.id === produtoId) || (fichaId && p.ficha_id === fichaId);
  if ((lista || []).some(casa)) {
    return lista.map(p => (casa(p) ? { ...p, ...(produtoId ? { id: produtoId } : {}), ficha_id: fichaId, preco_venda: preco } : p));
  }
  return [{ id: produtoId, ficha_id: fichaId, nome_produto: nome, preco_venda: preco }, ...(lista || [])];
}

// ─── Tudo junto ─────────────────────────────────────────────────────────────

export function resumoFinanceiroDaFicha(ficha = {}, { fichas = [], produtos = [], params = {} } = {}) {
  const tipo = tipoDaFicha(ficha);
  const custoReceita = custoDeProduzirFicha(ficha, fichas);
  const { porcoes, definidas } = porcoesParaCusto(ficha);
  const produto = produtoDaFicha(ficha, produtos);
  const ent = entradasFinanceirasDaFicha(ficha, { produto, params });

  const custoPorcaoReceita = custoReceita / porcoes;
  const embalagemPorcao = tipo === "preparo" ? 0 : ent.custoEmbalagemPorPorcao;
  const cmvValor = custoPorcaoReceita + embalagemPorcao;
  const preco = tipo === "preparo" ? 0 : ent.precoVenda;
  const meta = ent.cmvMeta;
  const linhas = linhasDeCustoDaFicha(ficha, fichas);

  // O CMV da composição é a receita linha a linha (por porção) mais a
  // embalagem por porção — a mesma soma de cmvValor, aberta.
  const cmvItens = tipo === "preparo" ? [] : [
    ...linhas.map(l => ({ rotulo: l.nome, valor: l.custo / porcoes,
      detalhe: l.tipo === "embalagem" ? null : { quantidade: l.quantidade, unidade: l.unidade, perdaPct: l.perdaPct || 0 } })),
    ...(embalagemPorcao > 0 ? [{ rotulo: "Embalagem (por porção)", valor: embalagemPorcao }] : []),
  ];
  const composicao = tipo === "preparo" ? null : composicaoDoPreco({
    preco, cmvItens, impostoPct: ent.impostoPct, taxaMaquininhaPct: ent.taxaMaquininhaPct, params,
  });
  // CMV % sempre valor ÷ preço, com o mesmo arredondamento da composição.
  const cmvPct = composicao?.temPreco && cmvValor > 0 ? composicao.cmv.pct : (preco > 0 && cmvValor > 0 ? percentualDe(cmvValor, preco) : null);

  return {
    tipo,
    produto,
    custoReceita,
    porcoes,
    porcoesDefinidas: definidas,
    custoPorcaoReceita,
    embalagemPorcao,
    cmvValor,
    cmvPct,
    meta,
    preco,
    // Preço sugerido = o preço em que o RESULTADO bate a meta de lucro, já
    // pagando CMV, despesas variáveis, CMO, despesas operacionais e
    // pró-labore (mesma conta da Pizza do Lucro). O preço pela meta de CMV
    // (custo ÷ meta) continua disponível como referência.
    precoSugerido: tipo === "preparo" || !(cmvValor > 0) ? null : precoParaMetaDeLucro({
      custoIngredientes: cmvValor, custoEmbalagem: 0, impostoPct: ent.impostoPct, taxaMaquininhaPct: ent.taxaMaquininhaPct,
      margemAlvoPct: Number(params?.margem_alvo_pct) || 0, params,
    }),
    metaLucro: Number(params?.margem_alvo_pct) || null,
    precoPelaMetaCmv: cmvValor > 0 && meta > 0 && meta < 100 ? cmvValor / (meta / 100) : null,
    impostoPct: ent.impostoPct,
    taxaMaquininhaPct: ent.taxaMaquininhaPct,
    composicao,
    status: statusDaFicha(ficha, cmvPct, meta),
    // Cada linha também em % do preço de venda (custo por porção ÷ preço).
    linhas: linhas.map(l => ({ ...l, pctVenda: preco > 0 ? percentualDe(l.custo / porcoes, preco) : null })),
  };
}
