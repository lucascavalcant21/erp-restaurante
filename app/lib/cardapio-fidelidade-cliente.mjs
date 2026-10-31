// "Minha fidelidade" e "Minha área" do cliente (protótipos DeliveryFidelidade
// e ClienteArea, 9N.5) — regras puras. Tudo sai do que o servidor mandou para
// o telefone provado por este aparelho (lerFidelidadePublica) e do cardápio
// público: nada de saldo, nome ou pedido inventado.

import { pontosDoCashback, pontosDoGasto } from "./fidelidade.mjs";

const c2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** O primeiro prato do cartão que está no cardápio agora (para "Pedir 1 …"). */
function pratoDoCartao(cartao, porId) {
  for (const id of cartao.produto_ids || []) {
    const p = porId.get(id);
    if (p) return { id: p.id, nome: p.nome, preco: p.preco };
  }
  return null;
}

export function resumoDaFidelidade(fid, status, cardapio) {
  const porId = new Map((cardapio?.produtos || []).map((p) => [p.id, p]));
  const identificado = Boolean(status?.identificado && status?.disponivel);
  const saldo = identificado ? c2(status.cashback?.saldo) : 0;
  const cb = fid?.cashback || null;
  const cartoes = (fid?.cartoes || []).map((c) => {
    const s = identificado ? status.cartoes?.[c.id] : null;
    const total = c.selos;
    const tem = s ? Math.min(total, s.selos) : 0;
    const completo = Boolean(s && s.selos >= total);
    const prato = pratoDoCartao(c, porId);
    const faltam = Math.max(0, total - tem);
    return {
      id: c.id, nome: c.nome, recompensa: c.recompensa, total, tem, faltam, completo, por: c.por, prato,
      codigo: status?.premios?.[c.id]?.codigo || "", valido_ate: status?.premios?.[c.id]?.valido_ate || null,
      // "Pedir 2 e já ganhar": só quando o selo é por unidade (por pedido, 2 unidades dão 1 selo).
      completar: prato && !completo && c.por !== "pedido" && faltam > 1 ? { n: faltam, valor: c2(prato.preco * faltam) } : null,
    };
  });
  return {
    identificado,
    nome: identificado ? status.nome || "" : "",
    cashback: cb ? { saldo, pontos: pontosDoCashback(saldo, cb), pontos_por_real: cb.pontos_por_real, valor_100: cb.valor_100 } : null,
    cartoes,
  };
}

/** A área do cliente: quanto economizou, o que falta pouco e os pedidos. */
export function areaDoClienteVista(fid, status, cardapio) {
  const r = resumoDaFidelidade(fid, status, cardapio);
  const porId = new Map((cardapio?.produtos || []).map((p) => [p.id, p]));
  const tot = status?.totais || { pedidos: 0, pago: 0, desconto: 0, cashback_usado: 0 };
  const economizou = c2(tot.desconto + tot.cashback_usado);
  const cb = fid?.cashback;
  // Cartão mais perto de completar (com selo e sem prêmio aberto).
  const perto = r.cartoes.filter((c) => c.tem > 0 && !c.completo).sort((a, b) => a.faltam - b.faltam)[0] || null;
  let pontos = null;
  if (cb && r.identificado && cb.valor_100 > 0) {
    const atuais = r.cashback.pontos;
    const resto = atuais % 100;
    const faltam = 100 - resto;
    // Primeiro os que completam sozinhos (o mais barato antes); depois os que rendem mais.
    const todos = (cardapio?.produtos || [])
      .map((p) => ({ id: p.id, nome: p.nome, foto: p.imagem_url || "", ganha: pontosDoGasto(p.preco, cb) }))
      .filter((p) => p.ganha > 0);
    const pratos = [
      ...todos.filter((p) => p.ganha >= faltam).sort((a, b) => a.ganha - b.ganha),
      ...todos.filter((p) => p.ganha < faltam).sort((a, b) => b.ganha - a.ganha),
    ].slice(0, 3);
    pontos = { faltam, valor: cb.valor_100, progresso: resto / 100, pratos };
  }
  const pedidos = (status?.pedidos || []).map((p) => ({
    id: p.id, em: p.em, tipo: p.tipo === "qrcode" || p.tipo === "salao" || p.tipo === "tablet" ? "qrcode" : p.tipo,
    total: p.total, economizou: p.economizou, pontos: cb ? pontosDoCashback(p.cashback, cb) : 0, selos: p.selos,
    itens: (p.itens || []).filter((i) => porId.has(i.id)),
    texto: (p.itens || []).map((i) => (porId.get(i.id) ? `${i.quantidade > 1 ? `${i.quantidade} ` : ""}${porId.get(i.id).nome}` : null)).filter(Boolean).join(", "),
  }));
  return {
    ...r,
    desde: status?.cliente_desde || null,
    nPedidos: tot.pedidos,
    economia: { total: economizou, comApp: c2(tot.pago), semApp: c2(tot.pago + economizou), desconto: c2(tot.desconto), cashback: c2(tot.cashback_usado) },
    perto,
    pontos,
    cadastro: fid?.cadastro || null,
    pedidos,
  };
}
