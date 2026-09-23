// ═══════════════════════════════════════════════════════════════
// FASE 3A — WHATSAPP RATE LIMITER & ANTI-ABUSE
// app/lib/server/channels/whatsapp/rate-limiter.mjs
// ═══════════════════════════════════════════════════════════════

const rateLimitWindows = new Map();

/**
 * Limita a taxa de requisições por número de telefone / chave no WhatsApp.
 * 
 * @param {string} key - Número de telefone ou identificador do canal
 * @param {number} maxRequests - Limite de requisições por janela (padrão: 20)
 * @param {number} windowMs - Janela de tempo em ms (padrão: 60.000ms = 1 min)
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
export function checkRateLimit(key, maxRequests = 20, windowMs = 60000) {
  const now = Date.now();
  let record = rateLimitWindows.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowMs
    };
    rateLimitWindows.set(key, record);
  }

  record.count++;
  const remaining = Math.max(0, maxRequests - record.count);
  const resetMs = Math.max(0, record.resetTime - now);
  const allowed = record.count <= maxRequests;

  return {
    allowed,
    remaining,
    resetMs
  };
}

/**
 * Limpa a janela de rate limit (usado em suítes de teste)
 */
export function clearRateLimiter() {
  rateLimitWindows.clear();
}
