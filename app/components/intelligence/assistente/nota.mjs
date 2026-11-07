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
