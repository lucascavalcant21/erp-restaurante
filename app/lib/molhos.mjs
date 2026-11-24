// MOLHOS (pedido do dono, 23/11/2026): as bases que são molho, com quanto
// rende cada uma. Molho é uma base (ficha técnica com eh_base) que tem
// "molho" (ou caldo, vinagrete, maionese…) no nome, ou está na categoria
// "Molhos". Serve para restaurante, delivery e eventos.

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NOME_MOLHO = /\b(molhos?|caldos?|vinagrete|maionese|aioli|pesto|chimichurri|tucupi|barbecue|bbq|ketchup|demi ?glace|fondo|fundo|redução|reducao|tare|teriyaki|guacamole|tahine|pasta de alho)\b/;

/** f: { nome, base, categoria } (cache do aparelho) ou ficha do banco ({ nome_receita, eh_base, categoria }). */
export function ehMolho(f) {
  const base = f?.base ?? f?.eh_base;
  if (!base) return false;
  const nome = semAcento(f.nome ?? f.nome_receita);
  const cat = semAcento(f.categoria).trim();
  return NOME_MOLHO.test(nome) || /^molhos?$/.test(cat);
}

const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const UN = { kg: "kg", g: "g", l: "L", lt: "L", litro: "L", litros: "L", ml: "ml", un: "un", porcoes: "porções", porcao: "porções" };

/** "Rende 3 L" / "Rende 2,5 kg" ou DADOS INSUFICIENTES quando a ficha não tem rendimento. */
export function textoRendimento(qtd, unidade) {
  const q = Number(qtd);
  if (!(q > 0)) return "Rendimento não cadastrado";
  const u = UN[semAcento(unidade).trim()] || String(unidade || "").trim() || "";
  return `Rende ${fmt(q)}${u ? ` ${u}` : ""}`;
}
