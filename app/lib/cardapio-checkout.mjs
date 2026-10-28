// CHECKOUT DO DELIVERY (protótipo DeliveryCheckout, 9.7.1 da spec) — regras puras.
// A tela mostra; quem cobra e confere de novo é o servidor (criarPedidoPublico).

import { totalDoCarrinho } from "./cardapio-digital.mjs";
import { trocoEmReais } from "./troco.mjs";

/**
 * Valores do pedido e o que impede de enviar, com o motivo explícito (9.7.1,
 * item 8): endereço, mínimo, troco, dados do cliente.
 */
export function resumoDoCheckout({ cardapio, carrinho, tipo, pagamento, form, descontoCadastro = 0, cashback = 0 }) {
  const tot = totalDoCarrinho(carrinho, cardapio, { tipo });
  const desconto = Math.round((descontoCadastro + cashback) * 100) / 100;
  const total = Math.max(0, Math.round((tot.total - desconto) * 100) / 100);
  const tel = String(form?.telefone || "").replace(/\D/g, "");
  const troco = pagamento === "dinheiro" ? trocoEmReais(form?.troco) : null;
  let motivo = "";
  if (tipo === "delivery" && tot.falta_minimo > 0) motivo = "falta_minimo";
  else if (String(form?.nome || "").trim().length < 2) motivo = "falta_nome";
  else if (tel.length < 10 || tel.length > 13) motivo = "falta_whatsapp";
  else if (tipo === "delivery" && !String(form?.endereco || "").trim()) motivo = "falta_endereco";
  else if (!pagamento) motivo = "falta_pagamento";
  else if (troco != null && troco < total) motivo = "troco_menor";
  return { subtotal: tot.subtotal, taxa: tot.taxa, falta_minimo: tot.falta_minimo, desconto, total, troco, motivo, pode: !motivo };
}
