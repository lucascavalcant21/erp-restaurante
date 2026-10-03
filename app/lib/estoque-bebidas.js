// Bebidas e embalados (saldo FECHADO x ABERTO).
//
// As gravações (entrada por unidade, baixa por unidade ou conteúdo, contagem
// e "zerar") passaram para as funções do banco da EST-MOV: a entrada/retirada
// com embalagens + fração (estoque_movimentar) mantém fechado x aberto do
// mesmo jeito, com motivo e histórico; contagem é pelo inventário; zerar não
// existe mais. Aqui fica só a conta de exibição.

// Divide um total (conteúdo) em fechadas + aberto, dado o conteúdo por embalagem.
export function dividirSaldo(total, conteudo, permiteFracionado = true) {
  const c = Number(conteudo) || 1;
  const t = Number(total) || 0;
  if (c <= 1 || !permiteFracionado) return { fechadas: t, aberto: 0 };
  const fechadas = Math.floor(t / c);
  return { fechadas, aberto: +(t - fechadas * c).toFixed(3) };
}
