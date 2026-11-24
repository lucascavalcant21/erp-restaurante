// CATEGORIAS DOS ITENS DO DELIVERY (dono, 24/11/2026: "no cadastro de ingredientes,
// bebidas e embalagens eu posso criar categorias para pôr cada item").
// A categoria é a coluna `insumos.categoria`. As categorias antigas automáticas
// ("Marmitaria", "Bebidas da marmitaria"…) contam como "sem categoria".

export const SUGESTOES_CATEGORIA = Object.freeze({
  ingrediente: ["Proteínas", "Hortifrúti", "Mercearia", "Laticínios", "Temperos e molhos", "Congelados"],
  bebida: ["Refrigerantes", "Sucos", "Águas", "Cervejas", "Outras bebidas"],
  embalagem: ["Marmitas e potes", "Tampas", "Sacolas", "Talheres e guardanapos", "Etiquetas"],
});
export const SEM_CATEGORIA = "Sem categoria";
const LEGADAS = new Set(["marmitaria", "embalagens da marmitaria", "bebidas da marmitaria", "limpeza da marmitaria", "outros", ""]);

const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const chave = (v) => limpo(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A categoria que a pessoa escolheu ("" quando é a automática antiga). */
export const categoriaDoItem = (item) => (LEGADAS.has(chave(item?.categoria)) ? "" : limpo(item?.categoria));

/** Opções para escolher: as já usadas primeiro, depois as sugeridas do tipo. */
export function opcoesCategoria(itens = [], tipo = "ingrediente") {
  const usadas = [...new Set(itens.map(categoriaDoItem).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const vistos = new Set(usadas.map(chave));
  return [...usadas, ...(SUGESTOES_CATEGORIA[tipo] || []).filter((s) => !vistos.has(chave(s)))];
}

/** Itens divididos por categoria (A–Z), "Sem categoria" no fim. */
export function agruparItens(itens = []) {
  const mapa = new Map();
  for (const i of itens) {
    const c = categoriaDoItem(i) || SEM_CATEGORIA;
    if (!mapa.has(c)) mapa.set(c, []);
    mapa.get(c).push(i);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === SEM_CATEGORIA) - (b === SEM_CATEGORIA) || a.localeCompare(b, "pt-BR"))
    .map(([categoria, lista]) => ({ categoria, itens: lista }));
}

/** Nome da categoria nova: sem espaço sobrando, até 40 letras, primeira maiúscula. */
export function nomeCategoria(v) {
  const t = limpo(v).slice(0, 40);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}
