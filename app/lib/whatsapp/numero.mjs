// Números de WhatsApp: só dígitos (E.164 sem "+"), e a regra do 9º dígito do
// Brasil: a Meta pode entregar um celular BR com ou sem o 9 (55 DD 9XXXXXXXX
// ou 55 DD XXXXXXXX). Os dois formatos são o MESMO número; nenhum outro é.

export const soDigitos = (n) => String(n ?? "").replace(/\D/g, "");

function formasBR(d) {
  if (!d.startsWith("55")) return [d];
  if (d.length === 13 && d[4] === "9") return [d, d.slice(0, 4) + d.slice(5)];
  if (d.length === 12 && /[6-9]/.test(d[4])) return [d, `${d.slice(0, 4)}9${d.slice(4)}`];
  return [d];
}

export function mesmoNumero(a, b) {
  const da = soDigitos(a), db = soDigitos(b);
  if (da.length < 10 || db.length < 10) return false;
  return formasBR(da).includes(db);
}

/** WHATSAPP_NUMEROS_DONO="5511999999999,5511888888888" → lista de dígitos (vazia = ninguém). */
export function numerosAutorizados(env = process.env) {
  return String(env.WHATSAPP_NUMEROS_DONO || "").split(/[,;\s]+/).map(soDigitos).filter((d) => d.length >= 10);
}

export const numeroAutorizado = (numero, env = process.env) => numerosAutorizados(env).some((n) => mesmoNumero(n, numero));

/** Para log e relatório: nunca o número inteiro. */
export const mascarar = (n) => { const d = soDigitos(n); return d.length > 4 ? `…${d.slice(-4)}` : "…"; };
