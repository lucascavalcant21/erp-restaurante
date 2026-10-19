// VIA DA COZINHA/BAR (regras puras, testadas em comanda-impressao.test.mjs)
//
// O KDS imprime sozinho cada item novo que chega à fila do setor: pedido do
// salão, da mesa pelo QR, do delivery ou do iFood. Item já impresso não sai
// de novo (nem ao recarregar a tela); ao ligar a impressão automática, o que
// já está na fila conta como impresso — só o que chegar depois sai.

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const LIMITE_IMPRESSOS = 800;

/**
 * Itens da fila que ainda não saíram na impressora, agrupados por ticket.
 * @param {Array} tickets fila do KDS (montarFilaKDS)
 * @param {Set<string>|Array<string>} impressos ids de itens já impressos
 * @returns {Array} tickets só com os itens novos (vazios ficam de fora)
 */
export function itensParaImprimir(tickets, impressos) {
  const ja = impressos instanceof Set ? impressos : new Set(impressos || []);
  return (Array.isArray(tickets) ? tickets : [])
    .map((t) => ({
      ...t,
      // Pedido que já teve via impressa: o que chega agora é acréscimo (garçom lançou mais).
      acrescimo: (t.itens || []).some((i) => ja.has(i?.id)),
      itens: (t.itens || []).filter((i) => i?.id && !ja.has(i.id) && i.status !== "entregue"),
    }))
    .filter((t) => t.itens.length > 0);
}

/** Junta os ids novos aos impressos, guardando só os mais recentes. */
export function marcarImpressos(impressos, novosIds, limite = LIMITE_IMPRESSOS) {
  const lista = [...(impressos instanceof Set ? impressos : impressos || [])];
  for (const id of novosIds || []) if (id && !lista.includes(id)) lista.push(id);
  return lista.slice(-limite);
}

const titulos = { bar: "BAR", todos: "PRODUÇÃO", cozinha: "COZINHA" };

function estilo(mm) {
  const grande = mm === 80 ? 20 : 16;
  return `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:${mm}mm;padding:3mm;color:#000}
.c{text-align:center}.g{font-size:${grande}px;font-weight:bold}.l{font-size:12px;margin:2px 0}
.sep{border-top:1px dashed #000;margin:6px 0}
.item{font-size:${mm === 80 ? 16 : 14}px;font-weight:bold;margin:6px 0}.item .q{font-size:${grande - 2}px}
.obs{font-size:12px;font-weight:normal;margin:2px 0 0 6px}
.via+.via{page-break-before:always;break-before:page}
@media print{@page{margin:0;size:${mm}mm auto}}`;
}

function corpoDaVia(ticket, { setor = "cozinha", unidade = "", agora = new Date() } = {}) {
  const hora = agora.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const itens = (ticket?.itens || []).map((i) => `
    <div class="item"><span class="q">${esc(i.quantidade)}x</span> ${esc(i.nome)}${i.observacao ? `<div class="obs">OBS: ${esc(i.observacao)}</div>` : ""}</div>`).join("");
  return `<div class="via">
<div class="c g">${esc(titulos[setor] || titulos.cozinha)}${ticket?.acrescimo ? " · ACRÉSCIMO" : ""}</div>
<div class="c l">${esc(ticket?.origem || "")}${ticket?.identificacao ? ` · ${esc(ticket.identificacao)}` : ""}</div>
${ticket?.cliente ? `<div class="c l">${esc(ticket.cliente)}</div>` : ""}
<div class="c l">#${esc(String(ticket?.id || "").slice(0, 4).toUpperCase())} · ${esc(hora)}</div>
<div class="sep"></div>${itens}<div class="sep"></div>
${unidade ? `<div class="c l">${esc(unidade)}</div>` : ""}
</div>`;
}

/**
 * HTML das vias (80 mm ou 58 mm), uma por página. Tudo que vem do pedido é
 * escapado: nome e observação podem ter sido digitados pelo cliente no
 * cardápio público.
 * @param {Array|object} tickets { id, origem, identificacao, cliente, acrescimo, itens: [{ quantidade, nome, observacao }] }
 * @param {object} opcoes { setor, unidade, largura: "80mm"|"58mm", agora: Date }
 */
export function htmlDasVias(tickets, opcoes = {}) {
  const lista = Array.isArray(tickets) ? tickets : [tickets];
  const mm = opcoes.largura === "58mm" ? 58 : 80;
  const titulo = titulos[opcoes.setor] || titulos.cozinha;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Via ${esc(titulo)}</title><style>
${estilo(mm)}
</style></head><body>${lista.map((t) => corpoDaVia(t, opcoes)).join("")}</body></html>`;
}

/** Uma via só (atalho de htmlDasVias); acrescimo pode vir nas opções. */
export function htmlDaVia(ticket, { acrescimo, ...opcoes } = {}) {
  return htmlDasVias([{ ...ticket, acrescimo: acrescimo ?? ticket?.acrescimo }], opcoes);
}
