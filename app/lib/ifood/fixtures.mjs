// DADOS SINTÉTICOS para testes — no formato dos exemplos da documentação do
// iFood (order/details e order/events). Nenhum valor aqui é real.

export const MERCHANT = "9a1b2c3d-0000-4000-8000-000000000001";
export const PEDIDO = "e1f2a3b4-0000-4000-8000-0000000000aa";

export function evento(code, minuto, extra = {}) {
  const longos = { PLC: "PLACED", CFM: "CONFIRMED", PRS: "PREPARATION_STARTED", RTP: "READY_TO_PICKUP", DSP: "DISPATCHED", CON: "CONCLUDED", CAN: "CANCELLED", CAR: "CANCELLATION_REQUESTED", HSD: "HANDSHAKE_DISPUTE", HSS: "HANDSHAKE_SETTLEMENT", OPA: "ORDER_PATCHED" };
  return {
    id: `ev-${code}-${minuto}-${extra.orderId || PEDIDO}`.slice(0, 60), code, fullCode: longos[code] || code,
    orderId: PEDIDO, merchantId: MERCHANT, salesChannel: "IFOOD", category: "FOOD",
    createdAt: new Date(Date.UTC(2026, 9, 14, 15, minuto, 0)).toISOString(), metadata: {}, ...extra,
  };
}

/** Pedido: 2 marmitas de frango (R$ 25 cada) + 1 refrigerante (R$ 6), entrega R$ 5 pela loja. */
export function detalhes(extra = {}) {
  return {
    id: PEDIDO, displayId: "4821", orderType: "DELIVERY", orderTiming: "IMMEDIATE", salesChannel: "IFOOD", category: "FOOD",
    createdAt: "2026-10-14T15:00:00.000Z", isTest: false,
    merchant: { id: MERCHANT, name: "Marmitaria Teste" },
    customer: { id: "c1", name: "Maria Souza Lima", documentNumber: "39845612077", phone: { number: "0800 000 0000", localizer: "12345678" } },
    items: [
      { index: 1, id: "it-1", uniqueId: "u-1", externalCode: "MARM-FRANGO", name: "Marmita de frango", quantity: 2, unitPrice: 25, price: 50, optionsPrice: 0, totalPrice: 50, options: [] },
      { index: 2, id: "it-2", uniqueId: "u-2", externalCode: "REFRI-350", name: "Refrigerante lata", quantity: 1, unitPrice: 6, price: 6, optionsPrice: 0, totalPrice: 6, options: [] },
    ],
    benefits: [
      { value: 5.6, target: "CART", sponsorshipValues: [{ name: "IFOOD", value: 3 }, { name: "MERCHANT", value: 2.6 }] },
    ],
    additionalFees: [{ type: "SMALL_ORDER_FEE", value: 1.5 }],
    total: { subTotal: 56, deliveryFee: 5, benefits: 5.6, additionalFees: 1.5, orderAmount: 56.9 },
    payments: { prepaid: 56.9, pending: 0, methods: [{ value: 56.9, currency: "BRL", type: "ONLINE", method: "CREDIT", card: { brand: "VISA" }, transaction: { authorizationCode: "SECRETO" } }] },
    delivery: { mode: "DEFAULT", deliveredBy: "MERCHANT", deliveryAddress: { streetName: "Rua X", streetNumber: "1" } },
    ...extra,
  };
}

// Canal iFood configurado pelo dono (números do TESTE, não do contrato real)
export const CANAL_TESTE = { id: "ifood", nome: "iFood", comissao_pct: 12, comissao_base: "receita", taxa_pagamento_pct: 3.2, pagamento_na_comissao: false, taxa_fixa_pedido: 1 };
