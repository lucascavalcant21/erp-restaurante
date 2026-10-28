// Troco do pedido pago em dinheiro: "150", "150,00", "R$ 150,00", "1.000" → em
// reais. Vazio ou inválido → null. Usado pela tela (aviso) e pelo servidor (trava).
export function trocoEmReais(v) {
  const limpo = String(v ?? "").replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
