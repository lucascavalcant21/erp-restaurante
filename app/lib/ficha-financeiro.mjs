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
//   rateio do custo fixo ..... rateioPorPrato (pizza-do-prato), com os
//                              parâmetros de Financeiro → Pizza do prato
//
//   CMV R$  = custo da receita ÷ porções + embalagem por porção
//   CMV %   = CMV R$ ÷ preço × 100
//   custos variáveis = CMV R$ + imposto + maquininha   (variam com a venda)
//   margem de contribuição = preço − custos variáveis
//   custos fixos     = aluguel, luz, gás, água, limpeza, outros + CMO, rateados
//   lucro            = preço − custos variáveis − custos fixos

import {
  parseNumero, custoDeProduzirFicha, porcoesParaCusto, produtoDaFicha,
  entradasFinanceirasDaFicha, tipoDaFicha,
} from "./ficha-calculos.mjs";
import { custoDoInsumo, fatorCorrecaoDoItem } from "./custo-rendimento.mjs";
import { rateioPorPrato } from "./pizza-do-prato.mjs";

const centavos = (v) => Math.round((Number(v) || 0) * 100);
const reais = (c) => c / 100;

// ─── Composição do preço: variáveis + fixos + lucro = preço ─────────────────

// Os valores são arredondados em CENTAVOS antes de somar, e o lucro é o que
// sobra do preço em centavos — por isso a soma exibida fecha exatamente no
// preço. Os percentuais seguem a mesma regra (o do lucro fecha em 100,00%).
//
// Custo fixo só entra quando há rateio de verdade (dias de operação × pratos
// por dia, e algum custo cadastrado). Sem isso, `fixos.rateado` é false, o
// fixo fica fora e o que sobra é "antes dos custos fixos" — não lucro.
export function composicaoDoPreco({
  preco = 0, custoProduto = 0, impostoPct = 0, taxaMaquininhaPct = 0, params = {},
} = {}) {
  const precoC = centavos(Math.max(0, parseNumero(preco)));
  const cmvC = centavos(Math.max(0, parseNumero(custoProduto)));
  const impostoC = centavos(reais(precoC) * Math.max(0, parseNumero(impostoPct)) / 100);
  const maquininhaC = centavos(reais(precoC) * Math.max(0, parseNumero(taxaMaquininhaPct)) / 100);

  const partesVariaveis = [
    { rotulo: "CMV (ingredientes e embalagem)", centavos: cmvC },
    { rotulo: `Imposto (${parseNumero(impostoPct).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`, centavos: impostoC },
    { rotulo: `Maquininha (${parseNumero(taxaMaquininhaPct).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`, centavos: maquininhaC },
  ];
  const variaveisC = cmvC + impostoC + maquininhaC;

  const rateio = rateioPorPrato(params || {});
  const partesFixos = rateio.rateavel
    ? [...rateio.itensFixo.map(i => ({ rotulo: i.rotulo, centavos: centavos(i.valor) })),
       { rotulo: "Mão de obra (CMO)", centavos: centavos(rateio.cmo) }].filter(p => p.centavos > 0)
    : [];
  const fixosC = partesFixos.reduce((t, p) => t + p.centavos, 0);
  const motivoSemFixo = !rateio.rateavel
    ? "Custo fixo ainda não rateado para este produto: falta informar dias de operação e pratos por dia em Financeiro → Pizza do prato."
    : (fixosC === 0 ? "Custo fixo ainda não rateado para este produto: nenhum custo fixo nem folha cadastrados em Financeiro → Pizza do prato." : null);
  const rateado = !motivoSemFixo;

  const lucroC = precoC - variaveisC - (rateado ? fixosC : 0);
  const pct = (c) => (precoC > 0 ? Math.round((c / precoC) * 10000) / 100 : 0);
  const variaveisPct = pct(variaveisC);
  const fixosPct = rateado ? pct(fixosC) : 0;
  const lucroPct = precoC > 0 ? Math.round((100 - variaveisPct - fixosPct) * 100) / 100 : 0;

  const comValor = (lista) => lista.map(p => ({ rotulo: p.rotulo, valor: reais(p.centavos), pct: pct(p.centavos) }));
  return {
    preco: reais(precoC),
    temPreco: precoC > 0,
    variaveis: { valor: reais(variaveisC), pct: variaveisPct, partes: comValor(partesVariaveis) },
    fixos: { valor: rateado ? reais(fixosC) : 0, pct: fixosPct, rateado, motivo: motivoSemFixo, partes: rateado ? comValor(partesFixos) : [] },
    lucro: { valor: reais(lucroC), pct: lucroPct, prejuizo: lucroC < 0, rotulo: rateado ? "Lucro" : "Sobra antes dos custos fixos" },
    margemContribuicao: { valor: reais(precoC - variaveisC), pct: precoC > 0 ? Math.round((100 - variaveisPct) * 100) / 100 : 0 },
    // Larguras da barra (0–100). Com prejuízo o todo é o custo, não o preço:
    // barra não tem fatia negativa.
    barra: (() => {
      const fix = rateado ? fixosC : 0;
      const todo = lucroC < 0 ? variaveisC + fix : precoC;
      if (todo <= 0) return [];
      return [
        { id: "variaveis", largura: (variaveisC / todo) * 100 },
        { id: "fixos", largura: (fix / todo) * 100 },
        { id: "lucro", largura: lucroC > 0 ? (lucroC / todo) * 100 : 0 },
      ].filter(s => s.largura > 0);
    })(),
  };
}

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
  const cmvPct = preco > 0 && cmvValor > 0 ? (cmvValor / preco) * 100 : null;

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
    precoSugerido: cmvValor > 0 && meta > 0 && meta < 100 ? cmvValor / (meta / 100) : null,
    impostoPct: ent.impostoPct,
    taxaMaquininhaPct: ent.taxaMaquininhaPct,
    composicao: tipo === "preparo" ? null : composicaoDoPreco({
      preco, custoProduto: cmvValor, impostoPct: ent.impostoPct, taxaMaquininhaPct: ent.taxaMaquininhaPct, params,
    }),
    status: statusDaFicha(ficha, cmvPct, meta),
    linhas: linhasDeCustoDaFicha(ficha, fichas),
  };
}
