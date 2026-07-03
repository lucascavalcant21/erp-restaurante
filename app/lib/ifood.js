// ============================================================================
// ifood.js — Cliente da API de Integração do iFood (Merchant API)
// ----------------------------------------------------------------------------
// Modelo: POLLING. A cada ciclo (cron), buscamos eventos novos, processamos os
// de "pedido colocado" e damos ACK pra não receber de novo.
//
// Credenciais via variáveis de ambiente (NUNCA commitar valores):
//   IFOOD_CLIENT_ID
//   IFOOD_CLIENT_SECRET
//   IFOOD_API_BASE   (opcional; default produção. Sandbox usa a mesma base com
//                     credenciais de teste, conforme o Portal do Desenvolvedor.)
//
// OBS: os nomes de campos da API podem variar levemente entre versões do iFood.
// Os pontos marcados com [VERIFICAR NO SANDBOX] devem ser confirmados no
// primeiro teste com credenciais reais de teste.
// ============================================================================

const BASE = process.env.IFOOD_API_BASE || "https://merchant-api.ifood.com.br";

export function ifoodConfigurado() {
  return !!(process.env.IFOOD_CLIENT_ID && process.env.IFOOD_CLIENT_SECRET);
}

// Cache simples de token em memória (vale enquanto a instância serverless estiver quente)
let _token = null;
let _tokenExp = 0;

export async function getAccessToken() {
  const agora = Date.now();
  if (_token && agora < _tokenExp - 60_000) return _token;

  const body = new URLSearchParams({
    grantType: "client_credentials",
    clientId: process.env.IFOOD_CLIENT_ID,
    clientSecret: process.env.IFOOD_CLIENT_SECRET,
  });

  const res = await fetch(`${BASE}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`iFood auth falhou: ${res.status} ${await res.text()}`);

  const data = await res.json();
  _token = data.accessToken;                       // [VERIFICAR NO SANDBOX]
  _tokenExp = agora + (data.expiresIn || 3600) * 1000;
  return _token;
}

async function apiGet(path) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`iFood GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Busca eventos novos (pedidos colocados, confirmados, cancelados, etc.)
export async function pollEventos() {
  const data = await apiGet(`/events/v1.0/events:polling`);
  return Array.isArray(data) ? data : [];
}

// ACK: confirma ao iFood que recebemos os eventos (senão ele reenvia)
export async function acknowledgeEventos(eventos) {
  if (!eventos.length) return;
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/events/v1.0/events/acknowledgment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventos.map((e) => ({ id: e.id }))),
  });
  if (!res.ok) throw new Error(`iFood ACK -> ${res.status} ${await res.text()}`);
}

// Detalhes completos de um pedido
export async function getPedido(orderId) {
  return apiGet(`/order/v1.0/orders/${orderId}`);
}

// Considera "pedido colocado" (varia: PLC / PLACED dependendo da versão)
export function isPedidoColocado(evento) {
  const code = (evento.code || evento.fullCode || "").toUpperCase();
  return code === "PLC" || code === "PLACED";
}
