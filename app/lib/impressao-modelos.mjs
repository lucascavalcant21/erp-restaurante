// MODELOS DE IMPRESSÃO (pedido do dono, 07/11/2026)
//
// Quatro vias editáveis por unidade: Cozinha, Bar, Conferência de conta e
// Recibo do caixa. O modelo é dado (não HTML): textos, o que aparece e o
// tamanho da letra. Daqui sai uma lista de LINHAS, e das linhas saem os dois
// formatos de impressora:
//   - HTML: janela do navegador e assistente de impressão (impressora instalada);
//   - ESC/POS: impressora térmica na rede (IP), USB direto e Bluetooth.
// Assim a prévia da tela, o papel do navegador e o papel da térmica mostram a
// mesma coisa. Funções puras, testadas em impressao-modelos.test.mjs.
// O cupom fiscal (DANFE NFC-e) tem leiaute definido pela SEFAZ e não entra aqui.

export const TIPOS_DE_VIA = {
  cozinha: { rotulo: "Cozinha", descricao: "Sai para a cozinha a cada item lançado." },
  bar: { rotulo: "Bar", descricao: "Sai para o bar a cada bebida lançada." },
  conferencia: { rotulo: "Conferência de conta", descricao: "O cliente confere antes de pagar." },
  recibo: { rotulo: "Recibo do caixa", descricao: "Comprovante não fiscal depois de pagar." },
};

export const TAMANHOS = { normal: "Normal", grande: "Grande", extra: "Extra grande" };

/** O que cada via pode mostrar, com o rótulo do editor. A ordem é a do papel. */
export const CAMPOS_DA_VIA = {
  producao: [
    ["nomeDaCasa", "Nome da casa"],
    ["mesa", "Mesa ou balcão"],
    ["origem", "Origem (salão, QR, delivery, iFood)"],
    ["garcom", "Garçom"],
    ["cliente", "Cliente"],
    ["numero", "Número do pedido"],
    ["hora", "Data e hora"],
    ["pessoa", "Pessoa da mesa em cada item"],
    ["obsDestaque", "Observação em destaque (fundo preto)"],
  ],
  conta: [
    ["nomeDaCasa", "Nome da casa"],
    ["documento", "CNPJ"],
    ["endereco", "Endereço"],
    ["telefone", "Telefone"],
    ["mesa", "Mesa ou balcão"],
    ["garcom", "Garçom"],
    ["cliente", "Cliente"],
    ["hora", "Data e hora"],
    ["taxaServico", "Taxa de serviço"],
    ["porPessoa", "Total por pessoa"],
    ["pagamentos", "Formas de pagamento e troco"],
    ["avisoNaoFiscal", "Aviso \"Não é documento fiscal\""],
  ],
};

const producao = (titulo) => ({
  titulo, tamanho: "grande", cabecalho: "", rodape: "", copias: 1, cortar: true,
  mostrar: { nomeDaCasa: false, mesa: true, origem: true, garcom: true, cliente: true, numero: true, hora: true, pessoa: true, obsDestaque: true },
});

export const MODELO_PADRAO = {
  casa: { nome: "", documento: "", endereco: "", telefone: "" },
  cozinha: producao("COZINHA"),
  bar: producao("BAR"),
  conferencia: {
    titulo: "CONFERÊNCIA DE CONTA", tamanho: "normal", cabecalho: "", rodape: "Confira os itens antes de pagar.", copias: 1, cortar: true,
    mostrar: { nomeDaCasa: true, documento: true, endereco: true, telefone: true, mesa: true, garcom: true, cliente: true, hora: true, taxaServico: true, porPessoa: true, pagamentos: false, avisoNaoFiscal: true },
  },
  recibo: {
    titulo: "RECIBO", tamanho: "normal", cabecalho: "", rodape: "Obrigado pela preferência!", copias: 1, cortar: true,
    mostrar: { nomeDaCasa: true, documento: true, endereco: true, telefone: true, mesa: true, garcom: true, cliente: true, hora: true, taxaServico: true, porPessoa: false, pagamentos: true, avisoNaoFiscal: true },
  },
};

const LIMITE_TEXTO = { titulo: 40, cabecalho: 300, rodape: 300, nome: 60, documento: 30, endereco: 120, telefone: 30 };
const texto = (v, max) => String(v ?? "").replace(/\r/g, "").slice(0, max);
const grupoDe = (tipo) => (tipo === "cozinha" || tipo === "bar" ? "producao" : "conta");

/** Modelo salvo + padrão, com cada campo conferido (o salvo pode estar velho ou incompleto). */
export function mesclarModelos(salvo = {}) {
  const s = salvo && typeof salvo === "object" ? salvo : {};
  const casaS = s.casa && typeof s.casa === "object" ? s.casa : {};
  const casa = {
    nome: texto(casaS.nome, LIMITE_TEXTO.nome), documento: texto(casaS.documento, LIMITE_TEXTO.documento),
    endereco: texto(casaS.endereco, LIMITE_TEXTO.endereco), telefone: texto(casaS.telefone, LIMITE_TEXTO.telefone),
  };
  const saida = { casa };
  for (const tipo of Object.keys(TIPOS_DE_VIA)) {
    const p = MODELO_PADRAO[tipo];
    const v = s[tipo] && typeof s[tipo] === "object" ? s[tipo] : {};
    const mostrarS = v.mostrar && typeof v.mostrar === "object" ? v.mostrar : {};
    const mostrar = {};
    for (const [campo] of CAMPOS_DA_VIA[grupoDe(tipo)]) mostrar[campo] = typeof mostrarS[campo] === "boolean" ? mostrarS[campo] : p.mostrar[campo];
    const copias = Math.round(Number(v.copias));
    saida[tipo] = {
      titulo: texto(v.titulo ?? p.titulo, LIMITE_TEXTO.titulo).trim() || p.titulo,
      tamanho: TAMANHOS[v.tamanho] ? v.tamanho : p.tamanho,
      cabecalho: texto(v.cabecalho ?? p.cabecalho, LIMITE_TEXTO.cabecalho),
      rodape: texto(v.rodape ?? p.rodape, LIMITE_TEXTO.rodape),
      copias: Number.isFinite(copias) ? Math.min(3, Math.max(1, copias)) : p.copias,
      cortar: typeof v.cortar === "boolean" ? v.cortar : p.cortar,
      mostrar,
    };
  }
  return saida;
}

/* ── Linhas ─────────────────────────────────────────────────────────────────
   { tipo: "texto", texto, alinhar: "esquerda"|"centro", tamanho, negrito, invertido }
   { tipo: "colunas", esquerda, direita, tamanho, negrito }
   { tipo: "separador" } */

const L = (t, extra = {}) => ({ tipo: "texto", texto: String(t ?? ""), alinhar: "esquerda", tamanho: "normal", negrito: false, invertido: false, ...extra });
const C = (esquerda, direita, extra = {}) => ({ tipo: "colunas", esquerda: String(esquerda ?? ""), direita: String(direita ?? ""), tamanho: "normal", negrito: false, ...extra });
const SEP = { tipo: "separador" };
const linhasDeTexto = (t, extra) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean).map((x) => L(x, extra));

export const brl = (v) => `R$ ${(Math.round((Number(v) || 0) * 100) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const dataHora = (d) => {
  const x = d instanceof Date ? d : new Date(d || Date.now());
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito", voucher: "Voucher", vr: "Voucher", outro: "Outro" };

/**
 * Via da cozinha ou do bar.
 * ticket: { id, origem, identificacao, cliente, garcom, acrescimo, created_at, itens: [{ quantidade, nome, observacao, pessoa }] }
 */
export function linhasDaProducao(tipo, ticket = {}, modelos = MODELO_PADRAO, { agora = new Date() } = {}) {
  const m = mesclarModelos(modelos)[tipo === "bar" ? "bar" : "cozinha"];
  const casa = mesclarModelos(modelos).casa;
  const ver = m.mostrar;
  const out = [];
  if (ver.nomeDaCasa && casa.nome) out.push(L(casa.nome, { alinhar: "centro" }));
  out.push(L(`${m.titulo}${ticket.acrescimo ? " - ACRÉSCIMO" : ""}`, { alinhar: "centro", tamanho: "extra", negrito: true }));
  out.push(...linhasDeTexto(m.cabecalho, { alinhar: "centro" }));
  if (ver.mesa && ticket.identificacao) out.push(L(ticket.identificacao, { alinhar: "centro", tamanho: "grande", negrito: true }));
  const info = [ver.origem && ticket.origem, ver.garcom && ticket.garcom && `Garçom: ${ticket.garcom}`].filter(Boolean);
  if (info.length) out.push(L(info.join(" · "), { alinhar: "centro" }));
  if (ver.cliente && ticket.cliente) out.push(L(`Cliente: ${ticket.cliente}`, { alinhar: "centro" }));
  const rodapeId = [ver.numero && ticket.id && `#${String(ticket.id).slice(0, 4).toUpperCase()}`, ver.hora && dataHora(agora)].filter(Boolean);
  if (rodapeId.length) out.push(L(rodapeId.join(" · "), { alinhar: "centro" }));
  out.push(SEP);
  for (const i of ticket.itens || []) {
    out.push(L(`${Number(i.quantidade) || 1}x ${i.nome || "Item"}`, { tamanho: m.tamanho, negrito: true }));
    if (ver.pessoa && i.pessoa) out.push(L(`  Para: ${i.pessoa}`));
    if (i.observacao) out.push(L(`  OBS: ${i.observacao}`, { negrito: true, invertido: !!ver.obsDestaque, tamanho: m.tamanho === "extra" ? "grande" : "normal" }));
  }
  out.push(SEP);
  out.push(...linhasDeTexto(m.rodape, { alinhar: "centro" }));
  return out;
}

/**
 * Conferência de conta ou recibo do caixa.
 * dados: { tipo: "salao"|"balcao", mesa, identificacao, garcom, cliente, data, itens: [{ nome, qtd, tot }],
 *          subtotal, desconto, taxa, total, recebidos: [{ forma, valor }], troco, porPessoa: [{ nome, total }] }
 */
export function linhasDaConta(tipo, dados = {}, modelos = MODELO_PADRAO) {
  const todos = mesclarModelos(modelos);
  const m = todos[tipo === "recibo" ? "recibo" : "conferencia"];
  const casa = todos.casa;
  const ver = m.mostrar;
  const out = [];
  if (ver.nomeDaCasa && casa.nome) out.push(L(casa.nome, { alinhar: "centro", tamanho: "grande", negrito: true }));
  if (ver.documento && casa.documento) out.push(L(`CNPJ ${casa.documento}`, { alinhar: "centro" }));
  if (ver.endereco && casa.endereco) out.push(L(casa.endereco, { alinhar: "centro" }));
  if (ver.telefone && casa.telefone) out.push(L(casa.telefone, { alinhar: "centro" }));
  out.push(...linhasDeTexto(m.cabecalho, { alinhar: "centro" }));
  out.push(SEP);
  out.push(L(m.titulo, { alinhar: "centro", negrito: true, tamanho: m.tamanho === "normal" ? "normal" : "grande" }));
  const onde = dados.identificacao || (dados.tipo === "salao" && dados.mesa ? `Mesa ${dados.mesa}` : dados.tipo === "salao" ? "" : "Balcão");
  if (ver.mesa && onde) out.push(L(onde, { alinhar: "centro" }));
  if (ver.garcom && dados.garcom) out.push(L(`Garçom: ${dados.garcom}`, { alinhar: "centro" }));
  if (ver.cliente && dados.cliente) out.push(L(`Cliente: ${dados.cliente}`, { alinhar: "centro" }));
  if (ver.hora) out.push(L(dataHora(dados.data), { alinhar: "centro" }));
  out.push(SEP);
  const tam = m.tamanho === "extra" ? "grande" : "normal";
  for (const i of dados.itens || []) out.push(C(`${Number(i.qtd) || 1}x ${i.nome || "Item"}`, brl(i.tot), { tamanho: tam }));
  out.push(SEP);
  out.push(C("Subtotal", brl(dados.subtotal)));
  if (Number(dados.desconto) > 0) out.push(C("Desconto", `-${brl(dados.desconto)}`));
  if (ver.taxaServico && Number(dados.taxa) > 0) out.push(C("Taxa de serviço", brl(dados.taxa)));
  out.push(C("TOTAL", brl(dados.total), { tamanho: "grande", negrito: true }));
  if (ver.porPessoa && Array.isArray(dados.porPessoa) && dados.porPessoa.length > 1) {
    out.push(SEP);
    out.push(L("Por pessoa", { negrito: true }));
    for (const p of dados.porPessoa) out.push(C(p.nome, brl(p.total)));
  }
  if (ver.pagamentos && Array.isArray(dados.recebidos) && dados.recebidos.length) {
    out.push(SEP);
    for (const p of dados.recebidos) out.push(C(FORMAS[p.forma] || p.forma, brl(p.valor)));
    if (Number(dados.troco) > 0) out.push(C("Troco", brl(dados.troco)));
  }
  out.push(SEP);
  if (ver.avisoNaoFiscal) out.push(L("NÃO É DOCUMENTO FISCAL", { alinhar: "centro", negrito: true }));
  out.push(...linhasDeTexto(m.rodape, { alinhar: "centro" }));
  return out;
}

/* ── HTML (navegador e assistente) ──────────────────────────────────────── */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PX = { normal: [12, 13], grande: [16, 18], extra: [21, 24] };

function linhaHtml(l, mm) {
  const px = PX[l.tamanho || "normal"][mm === 80 ? 1 : 0];
  if (l.tipo === "separador") return `<div class="sep"></div>`;
  const base = `font-size:${px}px;${l.negrito ? "font-weight:bold;" : ""}`;
  if (l.tipo === "colunas") return `<div class="col" style="${base}"><span>${esc(l.esquerda)}</span><span>${esc(l.direita)}</span></div>`;
  const cls = [l.alinhar === "centro" ? "c" : "", l.invertido ? "inv" : ""].filter(Boolean).join(" ");
  return `<div${cls ? ` class="${cls}"` : ""} style="${base}">${esc(l.texto)}</div>`;
}

/** Várias vias (cada uma é uma lista de linhas) num HTML só, uma por página. */
export function htmlDasVias(vias, { largura = "80mm", titulo = "Via" } = {}) {
  const mm = largura === "58mm" ? 58 : 80;
  const corpo = (vias || []).map((linhas) => `<div class="via">${(linhas || []).map((l) => linhaHtml(l, mm)).join("")}</div>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(titulo)}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:${mm}mm;padding:3mm;color:#000;background:#fff}
.c{text-align:center}.inv{background:#000;color:#fff;padding:1px 3px}
.col{display:flex;justify-content:space-between;gap:6px}.col span:first-child{flex:1;overflow-wrap:anywhere}.col span:last-child{white-space:nowrap}
.sep{border-top:1px dashed #000;margin:5px 0}
.via+.via{page-break-before:always;break-before:page}
@media print{@page{margin:0;size:${mm}mm auto}}
</style></head><body>${corpo}</body></html>`;
}

/* ── ESC/POS (rede, USB direto e Bluetooth) ─────────────────────────────── */

/** Colunas de texto por linha, na fonte normal. */
export const COLUNAS = { "80mm": 48, "58mm": 32 };
const FATOR = { normal: 1, grande: 2, extra: 2 };
const TAMANHO_ESCPOS = { normal: 0x00, grande: 0x01, extra: 0x11 }; // GS ! : grande = altura dupla; extra = altura e largura duplas

// Sem acento no ESC/POS: cada térmica usa uma tabela de caracteres diferente, e
// texto sem acento sai certo em todas. A prévia e o HTML mantêm os acentos.
const TROCAS = { "·": "-", "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "º": "o", "ª": "a", "°": "o", "€": "EUR", " ": " " };
export const semAcento = (t) => String(t ?? "")
  .replace(/[·–—“”‘’…ºª°€ ]/g, (c) => TROCAS[c])
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^\x20-\x7E]/g, "?");

function quebrar(textoLinha, largura) {
  const palavras = semAcento(textoLinha).split(" ");
  const linhas = [];
  let atual = "";
  for (const p of palavras) {
    let palavra = p;
    while (palavra.length > largura) { if (atual) { linhas.push(atual); atual = ""; } linhas.push(palavra.slice(0, largura)); palavra = palavra.slice(largura); }
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (tentativa.length > largura) { linhas.push(atual); atual = palavra; } else atual = tentativa;
  }
  if (atual || !linhas.length) linhas.push(atual);
  return linhas;
}

/** Texto puro da via, como sai na térmica (útil para teste e conferência). */
export function textoDaVia(linhas, { largura = "80mm" } = {}) {
  const cols = COLUNAS[largura] || 48;
  const out = [];
  for (const l of linhas || []) {
    const w = Math.floor(cols / (l.tipo === "separador" ? 1 : FATOR[l.tamanho || "normal"]));
    if (l.tipo === "separador") { out.push("-".repeat(cols)); continue; }
    if (l.tipo === "colunas") {
      const dir = semAcento(l.direita);
      const esqLinhas = quebrar(l.esquerda, Math.max(4, w - dir.length - 1));
      esqLinhas.forEach((e, idx) => out.push(idx === esqLinhas.length - 1 ? e + " ".repeat(Math.max(1, w - e.length - dir.length)) + dir : e));
      continue;
    }
    for (const t of quebrar(l.texto, w)) {
      out.push(l.alinhar === "centro" ? " ".repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t : t);
    }
  }
  return out.join("\n");
}

/** Bytes ESC/POS de várias vias, com corte de papel entre elas. */
export function escposDasVias(vias, { largura = "80mm", cortar = true } = {}) {
  const cols = COLUNAS[largura] || 48;
  const b = [];
  const push = (...x) => b.push(...x);
  const ascii = (t) => { for (const ch of semAcento(t)) push(ch.charCodeAt(0)); };
  push(0x1b, 0x40); // ESC @: reinicia a impressora
  for (const linhas of vias || []) {
    for (const l of linhas || []) {
      if (l.tipo === "separador") { push(0x1b, 0x61, 0x00, 0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00); ascii("-".repeat(cols)); push(0x0a); continue; }
      const tam = l.tamanho || "normal";
      const w = Math.floor(cols / FATOR[tam]);
      push(0x1d, 0x21, TAMANHO_ESCPOS[tam]); // GS ! n
      push(0x1b, 0x45, l.negrito ? 1 : 0); // ESC E n
      if (l.tipo === "colunas") {
        push(0x1b, 0x61, 0x00);
        const dir = semAcento(l.direita);
        const esqLinhas = quebrar(l.esquerda, Math.max(4, w - dir.length - 1));
        esqLinhas.forEach((e, idx) => { ascii(idx === esqLinhas.length - 1 ? e + " ".repeat(Math.max(1, w - e.length - dir.length)) + dir : e); push(0x0a); });
      } else {
        push(0x1b, 0x61, l.alinhar === "centro" ? 1 : 0); // ESC a n
        if (l.invertido) push(0x1d, 0x42, 1); // GS B 1: fundo preto
        for (const t of quebrar(l.texto, w)) { ascii(t); push(0x0a); }
        if (l.invertido) push(0x1d, 0x42, 0);
      }
    }
    push(0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00, 0x1b, 0x61, 0x00);
    push(0x1b, 0x64, 0x04); // ESC d 4: avança o papel até a lâmina
    if (cortar) push(0x1d, 0x56, 0x42, 0x00); // GS V 66 0: corte parcial
  }
  return new Uint8Array(b);
}
