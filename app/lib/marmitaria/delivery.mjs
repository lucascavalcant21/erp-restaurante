// "O das marmitas pode se chamar delivery. Eu posso criar um delivery chamado
// marmitas, ou hamburgueria, só de hambúrguer. Eu escolho o segmento"
// (dono, 16/11/2026). Primeiro passo: o dono dá nome e segmento ao delivery
// da unidade (config_sistema.params.delivery). Vários deliveries na mesma
// unidade pedem migração (missão no BACKLOG). Módulo puro.

export const SEGMENTOS = Object.freeze([
  { id: "marmitas", rotulo: "Marmitas", item: "marmita" },
  { id: "hamburgueria", rotulo: "Hamburgueria", item: "lanche" },
  { id: "pizzaria", rotulo: "Pizzaria", item: "pizza" },
  { id: "acai", rotulo: "Açaí", item: "copo" },
  { id: "japones", rotulo: "Comida japonesa", item: "combinado" },
  { id: "pastelaria", rotulo: "Pastelaria", item: "pastel" },
  { id: "outro", rotulo: "Outro", item: "item" },
]);

export const NOME_PADRAO = "Delivery";

export function normalizarDelivery(d) {
  const nome = String(d?.nome || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const segmento = SEGMENTOS.some((s) => s.id === d?.segmento) ? d.segmento : null;
  return { nome: nome || null, segmento };
}

/** Título do módulo: o nome que o dono deu; sem nome, o padrão. */
export function tituloDoDelivery(d) {
  const n = normalizarDelivery(d);
  if (!n.nome) return NOME_PADRAO;
  return /delivery/i.test(n.nome) ? n.nome : `${n.nome} · delivery`;
}
