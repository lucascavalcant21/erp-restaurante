// ÍCONE DE CADA SEÇÃO E PRATO DO CARDÁPIO (regras puras, testadas em
// cardapio-icones.test.mjs)
//
// No banco real, 1 em 167 pratos tem foto (19/10/2026). Sem foto, o cardápio
// usa um ícone que diz o que é (peixe, carne, drink, sobremesa…) no lugar do
// espaço vazio — nunca uma foto inventada. O nome decide; sem pista no nome,
// vale o papel da seção (comida, bebida, sobremesa).

import { normalizarBusca } from "./cardapio-digital.mjs";

// A ordem importa: o primeiro que casar vence ("caldo de peixe" é sopa).
const REGRAS = [
  ["adicional", /\b(adicional|adicionais|acompanhamento|acompanhamentos|extra|extras|guarnicao|guarnicoes)\b/],
  ["cafe", /\b(cafe|cafes|espresso|expresso|cappuccino|capuccino|coffee)\b/],
  ["cerveja", /\b(cerveja|cervejas|chope|chopp|beer|ipa|pilsen|lager)\b/],
  ["vinho", /\b(vinho|vinhos|wine|espumante|prosecco|champagne)\b/],
  ["suco", /\b(suco|sucos|juice|refri|refrigerante|refrigerantes|soda|agua|aguas|cha|limonada)\b/],
  ["drink", /\b(drink|drinks|coquetel|coqueteis|caipirinha|caipiroska|cocktail|gin|batida|dose|doses)\b/],
  ["sobremesa", /\b(sobremesa|sobremesas|doce|doces|dessert|bolo|torta|pudim|sorvete|sorvetes|acai|mousse|brigadeiro|creme de cupuacu)\b/],
  ["pizza", /\bpizzas?\b/],
  ["lanche", /\b(lanche|lanches|burger|burguer|hamburguer|sanduiche|sandwich|wrap|tapioca)\b/],
  ["sopa", /\b(sopa|sopas|caldo|caldos|soup|tacaca)\b/],
  ["peixe", /\b(peixe|peixes|fish|pirarucu|tambaqui|filhote|dourada|camarao|camaroes|caranguejo|frutos do mar|moqueca|caldeirada|file de)\b/],
  ["carne", /\b(carne|carnes|picanha|costela|bife|steak|churrasco|brasa|grelhado|grelhados|frango|porco|manicoba)\b/],
  ["salada", /\b(salada|saladas|salad|vegano|vegetariano|veggie)\b/],
  ["marmita", /\b(marmita|marmitas|quentinha|executivo|executivos|prato do dia)\b/],
  ["entrada", /\b(entrada|entradas|petisco|petiscos|porcao|porcoes|aperitivo|starter|tira gosto|bolinho)\b/],
];

/** Tema do ícone pelo nome; sem pista, pelo papel da seção. */
export function temaDoIcone(nome, papel = "comida") {
  const n = normalizarBusca(nome).replace(/[-_/]+/g, " ");
  for (const [tema, re] of REGRAS) if (re.test(n)) return tema;
  return papel === "bebida" ? "drink" : papel === "sobremesa" ? "sobremesa" : "prato";
}

/** Prato: o nome dele primeiro ("Caldo de peixe"); sem pista, a seção onde está. */
export function temaDoPrato(produto, categoria) {
  const doNome = temaDoIcone(produto?.nome, "");
  if (doNome !== "prato") return doNome;
  return categoria ? temaDoIcone(categoria.nome, categoria.papel) : "prato";
}

/** Iniciais da casa para o selo quando não há logo ("Sel de Estrela" → "SE"). */
export function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter((p) => p && !/^(de|da|do|das|dos|e|the|of)$/i.test(p));
  const letras = (partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes).map((p) => p[0]).join("");
  return (letras || String(nome || "?").trim()[0] || "?").toUpperCase().slice(0, 2);
}
