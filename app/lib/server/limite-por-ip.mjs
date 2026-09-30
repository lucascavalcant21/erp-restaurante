// Limite de envios por IP, em memória. É o que a infraestrutura atual permite
// (sem Redis/KV): vale por instância da função, então é FREIO, não garantia.
// O freio que sobrevive a várias instâncias é o do banco (mesmo telefone em
// 10 minutos), em portais-publicos.mjs.

const janelas = new Map();

export function ipDoPedido(request) {
  const xff = request.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || request.headers.get("x-real-ip") || "desconhecido";
}

/** true = pode seguir; false = estourou o limite desta janela. */
export function dentroDoLimite(chave, { maximo = 5, janelaMs = 10 * 60 * 1000, agora = Date.now() } = {}) {
  const lista = (janelas.get(chave) || []).filter((t) => agora - t < janelaMs);
  if (lista.length >= maximo) { janelas.set(chave, lista); return false; }
  lista.push(agora);
  janelas.set(chave, lista);
  if (janelas.size > 5000) {
    // Não deixa a memória crescer sem fim numa instância longa.
    for (const [k, v] of janelas) if (!v.some((t) => agora - t < janelaMs)) janelas.delete(k);
  }
  return true;
}
