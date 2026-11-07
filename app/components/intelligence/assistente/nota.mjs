// Foto da nota → corpo do pedido do Assistente Héfisto.
//
// 1. reduzirImagem: a foto do celular (vários MB) vira um JPEG de até 1600 px,
//    legível para a leitura e leve para enviar.
// 2. notaDoOcr: a resposta do /api/ocr (leitura da DANFE) no formato que o
//    servidor aceita (notaSchema em lancar-nota.mjs). Campos vazios saem,
//    itens sem nome ou quantidade saem; números já vêm convertidos do /api/ocr.

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v, max) => { const t = String(v ?? "").trim(); return t ? t.slice(0, max) : null; };
const numero = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 1e4) / 1e4 : null);

export function notaDoOcr(ocr) {
  if (!ocr || typeof ocr !== "object") return null;
  const itens = (Array.isArray(ocr.itens) ? ocr.itens : [])
    .map((i) => ({
      codigo: texto(i?.codigo, 40), nome: texto(i?.nome, 160), un: texto(i?.un, 12),
      qtd: numero(i?.qtd), valor_unitario: numero(i?.valor_unitario), preco: numero(i?.preco) ?? 0,
    }))
    .filter((i) => i.nome && i.qtd > 0)
    .slice(0, 60);
  if (!itens.length) return null;
  const nota = {
    fornecedor: texto(ocr.fornecedor, 160), cnpj: texto(ocr.cnpj, 24),
    numero: texto(String(ocr.numero ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, ""), 20),
    serie: texto(ocr.serie, 10), chave_acesso: texto(String(ocr.chave_acesso ?? "").replace(/\D/g, ""), 60),
    data_emissao: DATA.test(String(ocr.data_emissao || "")) ? ocr.data_emissao : null,
    valor_total: numero(ocr.valor_total), valor_frete: numero(ocr.valor_frete), valor_desconto: numero(ocr.valor_desconto),
    vencimentos: (Array.isArray(ocr.vencimentos) ? ocr.vencimentos : []).filter((v) => DATA.test(String(v?.data || ""))).slice(0, 24).map((v) => ({ data: v.data, valor: numero(v.valor) })),
    itens: itens.map((i) => Object.fromEntries(Object.entries(i).filter(([, v]) => v != null))),
  };
  return Object.fromEntries(Object.entries(nota).filter(([, v]) => v != null));
}

// ─── XML da NF-e (o arquivo que o fornecedor manda junto com a DANFE) ────────
// Dado exato do emissor, sem leitura de foto. Lido com expressões simples
// (roda igual no navegador e nos testes); só os campos da compra.
export const MAX_XML_BYTES = 2 * 1024 * 1024;
const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (t) => String(t).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e.toLowerCase()]));
const re = (nome, g = "") => new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${nome}>`, g);
const bloco = (xml, nome) => (xml.match(re(nome)) || [])[1] ?? null;
const campo = (xml, nome) => { const b = xml != null ? bloco(xml, nome) : null; return b == null ? null : desescapar(b.trim()); };
const valor = (xml, nome) => { const t = campo(xml, nome); const n = t == null || t === "" ? NaN : Number(t); return Number.isFinite(n) ? n : null; };

/**
 * XML da NF-e → o mesmo formato do /api/ocr, já limpo por notaDoOcr.
 * @returns {{ nota: object|null, erro: string|null }}
 */
export function notaDoXml(xml) {
  const t = String(xml || "");
  if (!/<(?:[\w-]+:)?infNFe\b/.test(t)) return { nota: null, erro: "Esse arquivo não é o XML de uma NF-e. Mande o XML que veio do fornecedor (ou a foto da DANFE)." };
  const inf = bloco(t, "infNFe") ?? t;
  const dets = [...inf.matchAll(re("det", "g"))].map((m) => m[1]);
  if (!dets.length) return { nota: null, erro: "O XML não tem itens." };
  if (dets.length > 60) return { nota: null, erro: `A nota tem ${dets.length} itens; pela conversa vão até 60. Lance pela tela de Compras.` };
  const emit = bloco(inf, "emit");
  const ide = bloco(inf, "ide");
  const tot = bloco(inf, "ICMSTot");
  const chave = (t.match(/<(?:[\w-]+:)?infNFe\b[^>]*\bId="NFe(\d{44})"/) || [])[1] || campo(t, "chNFe");
  const emissao = campo(ide, "dhEmi") || campo(ide, "dEmi");
  const ocr = {
    fornecedor: campo(emit, "xNome") || campo(emit, "xFant"),
    cnpj: campo(emit, "CNPJ") || campo(emit, "CPF"),
    numero: campo(ide, "nNF"), serie: campo(ide, "serie"), chave_acesso: chave,
    data_emissao: emissao ? emissao.slice(0, 10) : null,
    valor_total: valor(tot, "vNF"), valor_frete: valor(tot, "vFrete"), valor_desconto: valor(tot, "vDesc"),
    vencimentos: [...(bloco(inf, "cobr") || "").matchAll(re("dup", "g"))].map((m) => ({ data: campo(m[1], "dVenc"), valor: valor(m[1], "vDup") })),
    itens: dets.map((d) => {
      const prod = bloco(d, "prod") || "";
      return { codigo: campo(prod, "cProd"), nome: campo(prod, "xProd"), un: campo(prod, "uCom"), qtd: valor(prod, "qCom"), valor_unitario: valor(prod, "vUnCom"), preco: valor(prod, "vProd") };
    }),
  };
  const nota = notaDoOcr(ocr);
  if (!nota) return { nota: null, erro: "Não encontrei itens com nome e quantidade no XML." };
  if (nota.itens.length !== dets.length) return { nota: null, erro: "Algum item do XML veio sem nome ou quantidade. Lance pela tela de Compras." };
  return { nota: { ...nota, origem: "xml" }, erro: null };
}

/** Reduz a foto para enviar (navegador). Devolve { dataUrl, miniatura }. */
export async function reduzirImagem(arquivo, { lado = 1600, qualidade = 0.82, ladoMiniatura = 240 } = {}) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Não consegui abrir a foto.")); i.src = url; });
    const desenhar = (max, q) => {
      const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * escala);
      c.height = Math.round(img.naturalHeight * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", q);
    };
    return { dataUrl: desenhar(lado, qualidade), miniatura: desenhar(ladoMiniatura, 0.6) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
