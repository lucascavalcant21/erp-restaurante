// MODELO DA LOJA (pedido do dono, 05/11/2026): o cardápio organizado como a
// loja aparece na plataforma, com Mais pedidos, seções por categoria, foto,
// nome, descrição e preço, para copiar e colar. Lê as linhas do Cardápio, então
// preço e promoção são os mesmos. Funções puras (testes em modelo-loja.test.mjs).

import { ordenarCategorias } from "./cardapio.mjs";

const DESCONTO = new Set(["desconto_pct", "desconto_rs"]);
const dinheiro = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");

/** Preço como o campo da plataforma pede: só o número. */
export const precoParaColar = (v) => (v > 0 ? Number(v).toFixed(2).replace(".", ",") : "");

/** Os mais vendidos pelas vendas lançadas. Sem venda não entra: nada é presumido. */
export function maisPedidos(vendas = [], limite = 5) {
  const porFicha = new Map();
  for (const v of vendas || []) {
    const q = Number(v?.quantidade) || 0;
    if (v?.ficha_id && q > 0) porFicha.set(v.ficha_id, (porFicha.get(v.ficha_id) || 0) + q);
  }
  return [...porFicha.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite).map(([fichaId, quantidade]) => ({ fichaId, quantidade }));
}

export function modeloDaLoja({ linhas = [], vendas = [] } = {}) {
  const promoDe = (fichaId) => linhas.find((l) => l.secao === "promocoes" && l.ficha?.id === fichaId);
  const itemDaFicha = (l) => {
    const promo = promoDe(l.ficha?.id);
    const comDesconto = promo && DESCONTO.has(promo.oferta?.tipo) ? promo : null;
    const descricao = String(l.ficha?.descricao_comercial || l.ficha?.descricao || "").trim();
    const foto = l.ficha?.imagem || "";
    const preco = comDesconto ? comDesconto.precoPago : l.semPreco ? null : l.precoPago;
    return {
      id: l.id, fichaId: l.ficha?.id || null, nome: l.nome, descricao, foto, preco,
      precoDe: comDesconto ? comDesconto.precoCheio : null,
      selo: promo?.rotulo || null, semPreco: !(preco > 0), semFoto: !foto, semDescricao: !descricao,
    };
  };

  const proprios = linhas.filter((l) => l.secao === "marmitas");
  const itens = new Map(proprios.map((l) => [l.ficha?.id, itemDaFicha(l)]));
  const categorias = ordenarCategorias(proprios.map((l) => l.categoria)).map((c) => ({
    id: c, titulo: c, itens: proprios.filter((l) => l.categoria === c).map(itemDaFicha),
  }));
  const combos = linhas.filter((l) => l.secao === "combos").map((l) => ({
    id: l.id, fichaId: null, nome: l.nome, descricao: l.descricao || "", foto: "", preco: l.precoPago,
    precoDe: l.precoCheio > l.precoPago ? l.precoCheio : null, selo: null, semPreco: !(l.precoPago > 0), semFoto: false, semDescricao: false, combo: true,
  }));
  const destaque = maisPedidos(vendas).map((m) => itens.get(m.fichaId)).filter(Boolean);
  const todos = [...itens.values()];
  return {
    maisPedidos: destaque,
    secoes: [...(combos.length ? [{ id: "combos", titulo: "Combos", itens: combos }] : []), ...categorias],
    faltando: {
      foto: todos.filter((i) => i.semFoto).length,
      descricao: todos.filter((i) => i.semDescricao).length,
      preco: [...todos, ...combos].filter((i) => i.semPreco).length,
    },
  };
}

/** Texto do cardápio inteiro, seção por seção, na ordem de cadastro na plataforma. */
export function textoDoModelo(modelo) {
  const blocos = (modelo?.secoes || []).map((s) => {
    const itens = s.itens.map((i) => [i.nome, i.descricao, i.preco > 0 ? dinheiro(i.preco) : "Sem preço"].filter(Boolean).join("\n"));
    return [s.titulo.toUpperCase(), ...itens].join("\n\n");
  });
  return blocos.join("\n\n\n");
}
