// FILA DO KDS (regras puras, testadas em kds-fila.test.mjs)
//
// O KDS lê pedidos_itens (status_kds): é onde caem os pedidos do salão
// (comanda do garçom), do cardápio digital (mesa pelo QR e delivery, depois de
// aceitos) e do iFood. A tela antiga lia vendas/venda_itens.status_preparo,
// coluna que não existe no banco real: a cozinha nunca via pedido nenhum.
//
// Ciclo do item: pendente → preparando → pronto (toque de novo volta a
// pendente). "Entregar" marca os itens do setor como entregue.

export const STATUS_NA_FILA = ["pendente", "preparando", "pronto"];

// Pedido nesses estados já saiu da cozinha (pago, servido, despachado ou cancelado).
const PEDIDO_FORA_DA_COZINHA = new Set(["cancelado", "recusado", "pago", "entregue", "fechado", "finalizado", "concluido", "saiu"]);

// Só pedidos online mudam de estado quando a cozinha termina: a comanda do salão
// fica "aberto" até o garçom fechar a conta.
const TIPOS_ONLINE = new Set(["delivery", "retirada", "qrcode", "ifood"]);
const ESTADOS_EM_PREPARO = new Set(["preparando_delivery", "preparando", "aberto", "pendente"]);

export function proximoStatusKDS(status) {
  if (!status || status === "pendente") return "preparando";
  if (status === "preparando") return "pronto";
  return "pendente";
}

/** Setor do produto: "bar" ou "cozinha" (sem cadastro, vai para a cozinha). */
export function setorDoProduto(departamento) {
  return /bar/i.test(String(departamento || "")) ? "bar" : "cozinha";
}

/** De onde veio o pedido, para o cabeçalho do ticket. */
export function origemDoPedido(pedido) {
  const t = pedido?.tipo_pedido;
  if (t === "qrcode") return "Mesa (QR)";
  if (t === "delivery") return "Delivery";
  if (t === "retirada") return "Retirada";
  if (t === "ifood") return "iFood";
  if (t === "balcao") return "Balcão";
  return "Salão";
}

/**
 * Agrupa as linhas de pedidos_itens (com produtos e pedidos embutidos) em
 * tickets, do mais antigo para o mais novo.
 * @param {Array} linhas
 * @param {"cozinha"|"bar"|"todos"} setor
 */
export function montarFilaKDS(linhas, setor = "cozinha") {
  const tickets = new Map();
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const ped = l?.pedidos;
    if (!ped?.id || PEDIDO_FORA_DA_COZINHA.has(ped.status)) continue;
    if (!STATUS_NA_FILA.includes(l.status_kds || "pendente")) continue;
    const s = setorDoProduto(l.produtos?.departamento);
    if (setor !== "todos" && s !== setor) continue;
    if (!tickets.has(ped.id)) {
      tickets.set(ped.id, {
        id: ped.id,
        tipo_pedido: ped.tipo_pedido || null,
        status: ped.status || null,
        origem: origemDoPedido(ped),
        cliente: ped.cliente_nome || null,
        identificacao: ped.identificacao || null,
        created_at: ped.created_at || l.created_at,
        itens: [],
      });
    }
    tickets.get(ped.id).itens.push({
      id: l.id,
      nome: l.produtos?.nome_produto || "Item",
      quantidade: Number(l.quantidade) || 1,
      observacao: l.observacao || null,
      status: l.status_kds || "pendente",
      setor: s,
      created_at: l.created_at,
    });
  }
  return [...tickets.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * Depois de entregar os itens de um setor: o pedido online vira "pronto"
 * (coluna Prontos do painel de pedidos online e TV) só quando nenhum item,
 * de nenhum setor, ainda está na fila.
 */
export function pedidoFicaPronto(pedido, itensDoPedido) {
  if (!pedido || !TIPOS_ONLINE.has(pedido.tipo_pedido)) return false;
  if (!ESTADOS_EM_PREPARO.has(pedido.status)) return false;
  const itens = Array.isArray(itensDoPedido) ? itensDoPedido : [];
  return itens.length > 0 && itens.every((i) => ["pronto", "entregue", "cancelado"].includes(i.status_kds));
}
