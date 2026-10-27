// Formulário da marmita ↔ dados gravados. Puro (testes em formulario.test.mjs).
//
// O id da marmita nasce quando o formulário abre e acompanha todas as
// tentativas de salvar: se a primeira gravou e a resposta se perdeu, a
// segunda vira atualização da mesma ficha, nunca uma duplicata.

import { novaChave } from "../contas-pagar.mjs";
import { parseNumero } from "../ficha-calculos.mjs";
import { paraUnidadeDoCadastro, custoDaMarmita } from "./nucleo.mjs";

export const TAMANHOS = ["P", "M", "G", "GG"];
export const TIPOS_EMBALAGEM = [
  { id: "marmitex", rotulo: "Marmitex ou pote" }, { id: "tampa", rotulo: "Tampa" }, { id: "sacola", rotulo: "Sacola" },
  { id: "talheres", rotulo: "Talheres" }, { id: "guardanapo", rotulo: "Guardanapo" }, { id: "etiqueta", rotulo: "Etiqueta" },
  { id: "outra", rotulo: "Outra" },
];

const texto = (n) => (n === null || n === undefined || n === "" ? "" : String(Math.round(Number(n) * 1000) / 1000).replace(".", ","));

export function unidadeDoItem(item, { insumos, fichas }) {
  if (item.subficha_id) return String(fichas.find((f) => f.id === item.subficha_id)?.rendimento_unidade || "un").toLowerCase();
  return String(insumos.get(item.insumo_id)?.unidade_medida || "un").toLowerCase();
}

// Quantidade gravada (unidade do cadastro) → como a cozinha fala: 0,15 kg = 150 g.
export function quantidadeParaTela(qtd, unidadeCadastro) {
  const q = Number(qtd) || 0;
  if (unidadeCadastro === "kg" && q > 0 && q < 1) return { qtd: texto(q * 1000), un: "g" };
  if (unidadeCadastro === "l" && q > 0 && q < 1) return { qtd: texto(q * 1000), un: "ml" };
  return { qtd: texto(q), un: unidadeCadastro || "un" };
}

export function formDaMarmita(m, ctx) {
  if (!m) {
    return { id: novaChave(), novo: true, codigo: "", nome: "", descricao: "", foto: "", categoria: "", tamanho: "M", peso: "", ativo: true, preco: "",
      itens: [], embalagens: [], precos: {} };
  }
  return {
    id: m.id, novo: false, codigo: m.codigo || "", nome: m.nome_receita || "", descricao: m.descricao_comercial || m.descricao || "",
    foto: m.imagem || "", categoria: m.categoria || "", tamanho: m.tamanho_marmita || "M", peso: texto(m.peso_final_g), ativo: m.ativo !== false,
    preco: texto(m.preco_venda),
    itens: (m.itens || []).map((it) => {
      const t = quantidadeParaTela(it.quantidade, unidadeDoItem(it, ctx));
      return { key: novaChave(), insumo_id: it.insumo_id || null, subficha_id: it.subficha_id || null, qtd: t.qtd, un: t.un, fator_correcao: it.fator_correcao || 0 };
    }),
    embalagens: (m.embalagens || []).map((e) => ({ key: novaChave(), insumo_id: e.insumo_id, qtd: texto(e.quantidade), tipo: e.tipo || "outra" })),
    precos: Object.fromEntries(Object.entries(m.precos || {}).map(([k, v]) => [k, texto(v)])),
  };
}

/** Itens do formulário na unidade do cadastro, prontos para o custo e para gravar. */
export function itensConvertidos(form, ctx) {
  return form.itens.map((it) => {
    const un = unidadeDoItem(it, ctx);
    const quantidade = paraUnidadeDoCadastro(it.qtd, it.un, un);
    return { insumo_id: it.insumo_id, subficha_id: it.subficha_id, quantidade, fator_correcao: Number(it.fator_correcao) || 0 };
  });
}

export function custoDoForm(form, ctx) {
  const itens = itensConvertidos(form, ctx).filter((i) => i.quantidade > 0);
  const embalagens = form.embalagens.map((e) => ({ insumo_id: e.insumo_id, quantidade: parseNumero(e.qtd) })).filter((e) => e.quantidade > 0);
  return custoDaMarmita({ itens, embalagens, fichas: ctx.fichas, insumos: ctx.insumos });
}

const lerValor = (t) => {
  const s = String(t ?? "").trim();
  if (!s) return null;
  const n = parseNumero(s);
  return Number.isFinite(n) ? n : null;
};

export function payloadDoForm(form, ctx, unidadeId) {
  const erros = [];
  const nome = String(form.nome || "").trim();
  if (nome.length < 2) erros.push("Informe o nome da marmita.");
  const itens = itensConvertidos(form, ctx);
  itens.forEach((it, i) => {
    const nomeItem = it.subficha_id ? ctx.fichas.find((f) => f.id === it.subficha_id)?.nome_receita : ctx.insumos.get(it.insumo_id)?.nome;
    if (it.quantidade === null) erros.push(`"${nomeItem || `Item ${i + 1}`}": a unidade escolhida não combina com o cadastro.`);
    else if (!(it.quantidade > 0)) erros.push(`Informe a quantidade de "${nomeItem || `item ${i + 1}`}".`);
  });
  const embalagens = form.embalagens.map((e) => ({ insumo_id: e.insumo_id, quantidade: parseNumero(e.qtd), tipo: e.tipo || "outra" }));
  if (embalagens.some((e) => !(e.quantidade > 0))) erros.push("Informe a quantidade de cada embalagem.");
  const preco = lerValor(form.preco);
  if (preco !== null && preco < 0) erros.push("O preço não pode ser negativo.");
  const precos = Object.entries(form.precos || {}).map(([canal, v]) => ({ canal, preco_venda: lerValor(v) })).filter((p) => p.preco_venda !== null);
  if (precos.some((p) => p.preco_venda < 0)) erros.push("Preço por canal não pode ser negativo.");
  const peso = lerValor(form.peso);
  if (erros.length) return { payload: null, erros };
  const custo = custoDoForm(form, ctx);
  return {
    erros: [],
    payload: {
      id: form.id, unidade_id: unidadeId, nome, descricao: form.descricao || "", foto: form.foto || "",
      categoria: form.categoria || "", tamanho: form.tamanho || "M", peso_final_g: peso, ativo: form.ativo !== false,
      preco_venda: preco ?? 0, custo_embalagens_total: custo.embalagens || 0,
      itens: itens.map((i) => ({ insumo_id: i.insumo_id, subficha_id: i.subficha_id, quantidade: i.quantidade, fator_correcao: i.fator_correcao })),
      embalagens, precos,
    },
  };
}

/* Catálogo de pré-preparos para montar a marmita com um toque (pedido do
 * dono, 27/10/2026: "a mesma coisa com as marmitas" do orçamento rápido de
 * eventos). Todos os pré-preparos da cozinha e do bar, por setor e categoria,
 * com o custo por kg/L/un da própria ficha (custoDeProduzirFicha ÷
 * rendimento). Sem custo ou rendimento: custo null (a tela mostra "sem custo").
 */
export function catalogoDePrePreparos(prePreparos = [], todasFichas = [], custoDeProduzir) {
  const grupos = new Map();
  for (const f of prePreparos || []) {
    if (!f || f.ativo === false) continue;
    const setor = String(f.departamento || "").toLowerCase() === "bar" ? "Bar" : "Cozinha";
    const categoria = String(f.categoria || "").trim() || "Outros";
    const chave = `${setor} · ${categoria}`;
    const rend = parseNumero(f.rendimento_porcoes);
    const custo = typeof custoDeProduzir === "function" ? custoDeProduzir(f, todasFichas) : 0;
    const un = String(f.rendimento_unidade || "un").toLowerCase();
    if (!grupos.has(chave)) grupos.set(chave, { grupo: chave, setor, itens: [] });
    grupos.get(chave).itens.push({ id: f.id, nome: f.nome_receita || "Pré-preparo", unidade: un, custoPorUnidade: rend > 0 && custo > 0 ? custo / rend : null });
  }
  return [...grupos.values()]
    .sort((a, b) => (a.setor === b.setor ? 0 : a.setor === "Cozinha" ? -1 : 1) || (a.grupo.endsWith("Outros") - b.grupo.endsWith("Outros")) || a.grupo.localeCompare(b.grupo, "pt-BR"))
    .map((g) => ({ ...g, itens: g.itens.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")) }));
}

/** Atalhos de quantidade por unidade (g e ml em gramas/mililitros; un em unidades). */
export function atalhosDeQuantidade(un) {
  const u = String(un || "").toLowerCase();
  if (u === "g" || u === "ml") return [50, 100, 150, 200];
  if (u === "kg" || u === "l") return [0.05, 0.1, 0.15, 0.2];
  return [1, 2];
}
