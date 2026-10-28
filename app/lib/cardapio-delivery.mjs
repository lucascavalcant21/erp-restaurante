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
