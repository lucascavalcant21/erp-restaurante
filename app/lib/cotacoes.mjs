// LISTA DE COMPRAS COM PESQUISA DE PREÇO (pedido do dono, 28/11/2026).
//
// "Vou no supermercado X, o produto custa 30; no Y, 28; no Z, tanto. O sistema
// compara os locais com o que eu tenho cadastrado e diz qual é a melhor opção.
// Eu escolho; se for diferente do cadastro, ele atualiza o ingrediente (e a
// ficha e a precificação). Fica o histórico de cada ingrediente em cada lugar,
// com data e horário, e qual eu escolhi; e o gráfico da variação."
//
// Funções puras (testes em cotacoes.test.mjs). Toda comparação é pelo preço
// NORMALIZADO (R$ por kg, por litro ou por unidade): R$ 30 no pacote de 5 kg e
// R$ 7 no de 1 kg só se comparam assim. Na tela o valor volta para a
// embalagem do cadastro ("R$ 28,00 por 5 kg"), que é como o dono pensa.

import { calcularPrecoNormalizado } from "./ingredientes-utils.mjs";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const FAMILIA = {
  g: "massa", kg: "massa", ml: "volume", l: "volume",
  un: "unidade", garrafa: "unidade", lata: "unidade", barril: "unidade", caixa: "unidade",
  pct: "unidade", pacote: "unidade", maco: "unidade", fardo: "unidade",
};
// Quanto 1 da unidade vale na base (kg, L ou unidade).
const NA_BASE = { g: 0.001, kg: 1, ml: 0.001, l: 1 };

export const unidadeDoCadastro = (u) => String(u || "").trim().toLowerCase();
export const familiaDaUnidade = (u) => FAMILIA[unidadeDoCadastro(u)] || null;

/** Unidades que a pesquisa aceita para um ingrediente: as da mesma família. */
export function unidadesDaPesquisa(unidadeCadastro) {
  const u = unidadeDoCadastro(unidadeCadastro);
  const f = familiaDaUnidade(u);
  if (f === "massa") return ["kg", "g"];
  if (f === "volume") return ["l", "ml"];
  return u ? [u] : [];
}

/** Tamanho da embalagem pesquisada convertido para a unidade do cadastro. */
export function tamanhoNaUnidadeDoCadastro(tamanho, unidade, unidadeCadastro) {
  const u = unidadeDoCadastro(unidade);
  const c = unidadeDoCadastro(unidadeCadastro);
  if (u === c) return num(tamanho);
  if (familiaDaUnidade(u) !== familiaDaUnidade(c) || !NA_BASE[u] || !NA_BASE[c]) return null;
  return (num(tamanho) * NA_BASE[u]) / NA_BASE[c];
}

/* Valida e completa uma pesquisa antes de gravar. Devolve { erro } ou a linha
 * pronta (com preco_normalizado), sem unidade_id: a unidade vem do banco. */
export function montarCotacao({ insumo, preco, tamanho, unidade, marca, fornecedorId, localNome, pesquisaId = null }) {
  const p = num(preco);
  const t = num(tamanho);
  const u = unidadeDoCadastro(unidade || insumo?.unidade_medida);
  if (!insumo?.id) return { erro: "Escolha o ingrediente." };
  if (!fornecedorId || !String(localNome || "").trim()) return { erro: "Diga em que lugar viu o preço." };
  if (!(p > 0)) return { erro: "Digite o preço." };
  if (!(t > 0)) return { erro: "Digite o tamanho da embalagem." };
  if (!unidadesDaPesquisa(insumo.unidade_medida).includes(u)) return { erro: `A embalagem precisa estar em ${unidadesDaPesquisa(insumo.unidade_medida).join(" ou ") || "uma unidade conhecida"}.` };
  const normal = calcularPrecoNormalizado(t, u, p);
  if (!(normal > 0)) return { erro: "Não deu para calcular o preço por unidade." };
  return {
    linha: {
      insumo_id: insumo.id,
      fornecedor_id: fornecedorId,
      local_nome: String(localNome).trim().slice(0, 120),
      marca: String(marca || "").trim().slice(0, 120) || null,
      preco: Math.round(p * 100) / 100,
      tamanho_embalagem: t,
      unidade_embalagem: u,
      preco_normalizado: Number(normal.toFixed(6)),
      pesquisa_id: pesquisaId,
    },
  };
}

/** Preço normalizado do cadastro (R$ por kg, L ou unidade). null sem preço. */
export function precoNormalizadoDoCadastro(insumo) {
  const salvo = num(insumo?.preco_normalizado);
  if (salvo > 0) return salvo;
  const valor = num(insumo?.custo_compra);
  const tam = num(insumo?.tamanho_embalagem) || 1;
  const n = valor > 0 ? calcularPrecoNormalizado(tam, unidadeDoCadastro(insumo?.unidade_medida), valor) : 0;
  return n > 0 ? n : null;
}

/** Quanto custa, a este preço normalizado, a embalagem do cadastro. */
export function precoNaEmbalagemDoCadastro(precoNormalizado, insumo) {
  const tam = num(insumo?.tamanho_embalagem) || 1;
  const u = unidadeDoCadastro(insumo?.unidade_medida);
  const base = NA_BASE[u] ? tam * NA_BASE[u] : tam;
  return Math.round(num(precoNormalizado) * base * 100) / 100;
}

const pctDe = (novo, velho) => (velho > 0 ? ((novo - velho) / velho) * 100 : null);
const porData = (a, b) => String(a.registrada_em).localeCompare(String(b.registrada_em));

/* Compara os locais pesquisados para UM ingrediente.
 *
 * Cada local entra com a pesquisa MAIS RECENTE dele; a anterior no mesmo
 * local dá o "subiu/desceu". Marca o mais barato e o mais perto do preço do
 * cadastro. "Mais perto" só aparece quando não é o mesmo local do mais barato
 * — senão é a mesma informação duas vezes.
 */
export function compararLocais(insumo, cotacoes = []) {
  const cadastro = precoNormalizadoDoCadastro(insumo);
  const doInsumo = (cotacoes || []).filter((c) => c && c.insumo_id === insumo?.id && num(c.preco_normalizado) > 0).sort(porData);
  const porLocal = new Map();
  for (const c of doInsumo) {
    const lista = porLocal.get(c.fornecedor_id) || [];
    lista.push(c);
    porLocal.set(c.fornecedor_id, lista);
  }
  const locais = [...porLocal.values()].map((lista) => {
    const atual = lista[lista.length - 1];
    const anterior = lista.length > 1 ? lista[lista.length - 2] : null;
    const normal = num(atual.preco_normalizado);
    return {
      fornecedorId: atual.fornecedor_id,
      local: atual.local_nome,
      cotacao: atual,
      marca: atual.marca || null,
      precoNormalizado: normal,
      precoEquivalente: precoNaEmbalagemDoCadastro(normal, insumo),
      vsCadastroPct: cadastro ? pctDe(normal, cadastro) : null,
      anterior: anterior ? { registradaEm: anterior.registrada_em, precoEquivalente: precoNaEmbalagemDoCadastro(anterior.preco_normalizado, insumo) } : null,
      vsAnteriorPct: anterior ? pctDe(normal, num(anterior.preco_normalizado)) : null,
      escolhida: !!atual.escolhida,
      vezes: lista.length,
    };
  }).sort((a, b) => a.precoNormalizado - b.precoNormalizado);

  const melhor = locais[0] || null;
  let maisPerto = null;
  if (cadastro && locais.length > 1) {
    const perto = [...locais].sort((a, b) => Math.abs(a.precoNormalizado - cadastro) - Math.abs(b.precoNormalizado - cadastro))[0];
    if (perto && perto.fornecedorId !== melhor?.fornecedorId) maisPerto = perto;
  }
  return {
    cadastro: cadastro ? { precoNormalizado: cadastro, precoEquivalente: precoNaEmbalagemDoCadastro(cadastro, insumo) } : null,
    locais: locais.map((l) => ({ ...l, melhor: l === melhor, maisPerto: l === maisPerto })),
    melhor,
    maisPerto,
    economiaPct: melhor && locais.length > 1 ? pctDe(locais[locais.length - 1].precoNormalizado, melhor.precoNormalizado) : null,
  };
}

/* O que gravar no ingrediente ao escolher uma pesquisa. A unidade do cadastro
 * NÃO muda (mudar de kg para g mexeria em todas as fichas): o tamanho é
 * convertido para ela. Devolve null quando a escolha não muda o preço. */
export function camposDaEscolha(insumo, cotacao) {
  const u = unidadeDoCadastro(insumo?.unidade_medida);
  const tam = tamanhoNaUnidadeDoCadastro(cotacao?.tamanho_embalagem, cotacao?.unidade_embalagem, u);
  if (!(tam > 0)) return null;
  const valor = Math.round(num(cotacao.preco) * 100) / 100;
  const normal = calcularPrecoNormalizado(tam, u, valor);
  const atual = precoNormalizadoDoCadastro(insumo);
  const mudou = !atual || Math.abs(normal - atual) / atual > 0.00001
    || Math.abs(num(insumo?.custo_compra) - valor) > 0.004
    || Math.abs((num(insumo?.tamanho_embalagem) || 1) - tam) > 0.00001;
  return {
    mudou,
    campos: {
      tamanho_embalagem: Number(tam.toFixed(4)),
      custo_compra: valor,
      custo_unitario: valor / tam,
      preco_normalizado: normal,
      fornecedor_atual_id: cotacao.fornecedor_id,
      fornecedor: cotacao.local_nome,
      ...(cotacao.marca ? { marca: cotacao.marca } : {}),
    },
    variacaoPct: atual ? pctDe(normal, atual) : null,
  };
}

/* Linhas do gráfico: uma série por local, cada ponto no preço da embalagem do
 * cadastro, em ordem de data. */
export function seriesPorLocal(insumo, cotacoes = []) {
  const series = new Map();
  for (const c of [...(cotacoes || [])].filter((x) => x && x.insumo_id === insumo?.id).sort(porData)) {
    const s = series.get(c.fornecedor_id) || { fornecedorId: c.fornecedor_id, local: c.local_nome, pontos: [] };
    s.pontos.push({ data: c.registrada_em, valor: precoNaEmbalagemDoCadastro(c.preco_normalizado, insumo), escolhida: !!c.escolhida });
    series.set(c.fornecedor_id, s);
  }
  return [...series.values()];
}

/** Ingredientes da lista de compras: do setor, sem os arquivados ou unidos. */
export function ingredientesDaLista(insumos = [], setor = "cozinha") {
  const s = String(setor || "cozinha").toLowerCase();
  return (insumos || []).filter((i) => {
    if (!i || i.arquivado_em || i.unido_a) return false;
    const deps = Array.isArray(i.departamentos) && i.departamentos.length ? i.departamentos.map((d) => String(d).toLowerCase()) : [String(i.departamento || "cozinha").toLowerCase()];
    return deps.includes(s);
  });
}
