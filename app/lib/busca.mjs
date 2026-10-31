// BUSCA do Héfisto (pedido do dono, 30/10/2026): "pesquisar palavras sem
// acento que dão o mesmo resultado, e sem ç" e "o sistema entende o que estou
// pesquisando nas primeiras palavras". Uma regra só para as barras de busca:
//   - sem acento, sem ç, sem maiúscula: "acucar" acha "Açúcar";
//   - cada palavra digitada vale pelo começo: "bol car" acha "Bolinho de carne";
//   - a palavra também vale no meio do texto ("carne" acha "Bolinho de carne").

/** Texto sem acento, sem ç, minúsculo, com só letras, números e espaço. */
export function normalizarParaBusca(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const palavras = (v) => normalizarParaBusca(v).split(" ").filter(Boolean);

/** O texto (ou a lista de textos) casa com o que foi digitado? Busca vazia casa com tudo. */
export function casaBusca(texto, consulta) {
  const q = palavras(consulta);
  if (!q.length) return true;
  const alvo = palavras(Array.isArray(texto) ? texto.join(" ") : texto);
  const junto = alvo.join(" ");
  return q.every((w) => alvo.some((a) => a.startsWith(w)) || junto.includes(w));
}
