// Etiqueta do que chegou da compra (pedido do dono, 05/11/2026): colocou a
// validade e lançou no estoque, a etiqueta do produto sai junto.
//
// A quantidade já entrou no estoque pela compra. Por isso o registro da etiqueta
// vai com quantidade 0: criarEtiqueta só movimenta o estoque quando há quantidade,
// e somar de novo aqui dobraria o saldo.

export const COPIAS_MAX = 50;

export function copiasValidas(valor) {
  const n = Math.floor(Number(String(valor ?? "").replace(",", ".")));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, COPIAS_MAX) : 1;
}

/** Só sai etiqueta do que chegou de verdade e tem validade informada. */
export function etiquetasDoRecebimento(linhas = []) {
  return linhas
    .filter((l) => Number(l.recebida) > 0 && l.validade)
    .map((l) => {
      const nome = String(l.insumo?.nome || l.item?.descricao_snapshot || "Produto").trim();
      const marca = String(l.insumo?.marca || "").trim();
      return {
        produto: marca ? `${nome} ${marca}` : nome,
        quantidade: Number(l.recebida),
        unidade: String(l.insumo?.unidade_medida || "un").toLowerCase(),
        validade: l.validade,
        conservacao: l.conservacao || "Resfriado",
        copias: copiasValidas(l.copias),
      };
    });
}

// Meio-dia: a data pura seria lida como meia-noite em UTC e, no Brasil, viraria o dia anterior.
export const dataDaValidade = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`);

const dataBr = (iso) => String(iso || "").slice(0, 10).split("-").reverse().join("/");
const qtdTexto = (q) => String(Math.round(Number(q) * 1000) / 1000).replace(".", ",");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Etiqueta 60 × 40 mm para a impressão pelo navegador. */
export function htmlDasEtiquetas(lista = [], { unidadeNome = "", responsavel = "", recebidoEm = "" } = {}) {
  const uma = (e) => `<section><h1>${esc(e.produto).toUpperCase()}</h1>
<p>${esc(qtdTexto(e.quantidade))} ${esc(e.unidade)} · ${esc(e.conservacao).toUpperCase()}</p>
<p class="val">VAL.: ${esc(dataBr(e.validade))}</p>
<p>REC.: ${esc(dataBr(recebidoEm))}${e.codigo ? ` · ${esc(e.codigo)}` : ""}</p>
<p>${esc(responsavel).toUpperCase()}${unidadeNome ? ` · ${esc(unidadeNome)}` : ""}</p></section>`;
  const paginas = lista.flatMap((e) => Array.from({ length: copiasValidas(e.copias) }, () => uma(e))).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>
@page{size:60mm 40mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000}
section{width:60mm;height:40mm;padding:2mm;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;justify-content:center}
h1{margin:0 0 1mm;font-size:12pt;line-height:1.1}p{margin:0;font-size:8pt;line-height:1.25}.val{font-size:13pt;font-weight:900;margin:1mm 0}
</style></head><body>${paginas}</body></html>`;
}

/** "Peito de frango 5 kg (chegou 2,5 kg a mais do pedido)". */
export function textoDoRecebido(item = {}, unidade = "un") {
  const un = String(unidade || "un").toLowerCase();
  const recebida = Number(item.quantidade_embalagens) || 0;
  const base = `${item.descricao_snapshot || "Produto"} ${qtdTexto(recebida)} ${un}`;
  if (item.quantidade_pedida_embalagens === null || item.quantidade_pedida_embalagens === undefined) return base;
  const diferenca = Math.round((recebida - Number(item.quantidade_pedida_embalagens)) * 1000) / 1000;
  if (!diferenca) return base;
  return `${base} (chegou ${qtdTexto(Math.abs(diferenca))} ${un} a ${diferenca > 0 ? "mais" : "menos"} do pedido)`;
}
