// INÍCIO DO DELIVERY (protótipo DeliveryInicio) — regras puras.
// Tudo sai do cardápio que o servidor montou (montarCardapioPublico): nada de
// prato, preço ou desconto que o dono não cadastrou.

/**
 * "Agora na casa": as promoções que valem agora (com o prato que a promoção
 * baixa o preço) e, depois, os pratos que o dono marcou como destaque. Um
 * prato aparece uma vez só.
 */
export function itensAgoraNaCasa(cardapio, { rotuloDestaque = "Destaque", limite = 12 } = {}) {
  if (!cardapio) return [];
  const porId = new Map((cardapio.produtos || []).map((p) => [p.id, p]));
  const usados = new Set();
  const out = [];
  for (const promo of cardapio.promocoes || []) {
    if (promo.tipo === "aviso") continue;
    for (const id of promo.produto_ids || []) {
      const p = porId.get(id);
      if (!p || usados.has(id) || p.promocao_id !== promo.id) continue;
      usados.add(id);
      out.push(cartao(p, promo.titulo));
    }
  }
  for (const p of cardapio.produtos || []) {
    if (!p.destaque || usados.has(p.id)) continue;
    usados.add(p.id);
    out.push(cartao(p, rotuloDestaque));
  }
  // Sem promoção nem destaque no ar: os pratos da casa, primeiro os que têm
  // foto, para o topo não ficar vazio (mesmo rótulo de destaque).
  if (!out.length) {
    const comFoto = (cardapio.produtos || []).filter((p) => p.imagem_url);
    const semFoto = (cardapio.produtos || []).filter((p) => !p.imagem_url);
    for (const p of [...comFoto, ...semFoto].slice(0, Math.min(limite, 8))) out.push(cartao(p, rotuloDestaque));
  }
  return out.slice(0, limite);
}

function cartao(p, etiqueta) {
  return {
    id: p.id,
    produto_id: p.id,
    etiqueta,
    titulo: p.nome,
    preco: p.preco,
    de: p.preco_original && p.preco_original > p.preco ? p.preco_original : undefined,
    foto: p.imagem_url || "",
  };
}

/**
 * Convite do cadastro (banner verde): só com o cadastro ligado no programa de
 * fidelidade. `pontos` só quando há cashback (R$ 1 = 1 ponto; 100 pontos =
 * o percentual do cashback em reais).
 */
export function conviteDoCadastro(fidelidade) {
  const cad = fidelidade?.cadastro;
  if (!cad || !(Number(cad.desconto_pct) > 0)) return null;
  return {
    percentual: `${Math.round(Number(cad.desconto_pct))}%`,
    todos: cad.aplica === "sempre",
    pontos: Boolean(fidelidade.cashback),
  };
}

/** Pratos da sacola por id (quantidade), para marcar "2 na sacola" no card. */
export function quantidadesNaSacola(carrinho = []) {
  const m = new Map();
  for (const i of carrinho) m.set(i.id, (m.get(i.id) || 0) + (Number(i.quantidade) || 0));
  return m;
}

/**
 * "Combina com seu pedido" (9P): no máximo 2 sugestões, uma por papel que
 * falta na sacola (bebida, sobremesa), nunca algo que o cliente dispensou
 * neste pedido. Sem regra de preço especial cadastrada, o preço é o normal.
 * Prato em destaque vem antes; depois, a ordem da seção.
 */
export function sugestoesDaSacola(carrinho = [], cardapio, { dispensados = [] } = {}) {
  if (!cardapio || !carrinho.length) return [];
  const naSacola = new Set(carrinho.map((i) => i.id));
  const fora = new Set(dispensados);
  const papelDaCategoria = new Map((cardapio.categorias || []).map((c) => [c.id, c.papel]));
  const porId = new Map((cardapio.produtos || []).map((p) => [p.id, p]));
  const papeis = new Set([...naSacola].map((id) => papelDaCategoria.get(porId.get(id)?.categoria_id)));
  const out = [];
  for (const papel of ["sobremesa", "bebida"]) {
    if (papeis.has(papel)) continue;
    const candidatos = (cardapio.categorias || [])
      .filter((c) => c.papel === papel)
      .flatMap((c) => c.produto_ids.map((id, ordem) => ({ p: porId.get(id), ordem })))
      .filter(({ p }) => p && !naSacola.has(p.id) && !fora.has(p.id))
      .sort((a, b) => Number(!!b.p.destaque) - Number(!!a.p.destaque) || a.ordem - b.ordem);
    if (candidatos.length) {
      const p = candidatos[0].p;
      out.push({ id: p.id, papel, nome: p.nome, preco: p.preco, de: p.preco_original > p.preco ? p.preco_original : undefined, foto: p.imagem_url || "" });
    }
  }
  return out.slice(0, 2);
}

/** Itens da sacola com nome, foto e total (só para mostrar; quem cobra é o servidor). */
export function linhasDaSacola(carrinho = [], cardapio) {
  const porId = new Map((cardapio?.produtos || []).map((p) => [p.id, p]));
  return carrinho
    .map((i) => {
      const p = porId.get(i.id);
      if (!p) return null;
      return { id: i.id, nome: p.nome, foto: p.imagem_url || "", quantidade: i.quantidade, observacao: i.observacao || "", total: Math.round(p.preco * i.quantidade * 100) / 100 };
    })
    .filter(Boolean);
}
