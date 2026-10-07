// Etiquetas "Somente nome" e "Apenas imagem": desenho ÚNICO, usado pela
// MDK-022 (TSPL) e pela térmica ESC/POS (TP-20 / Bluetooth). Ocupam a área
// útil inteira da etiqueta e ficam centralizados nos dois sentidos; o tamanho
// é ajustável (escala 0,5× a 2×). As margens e o deslocamento da calibração
// (Configurações → Etiquetas) definem a área útil — quem chama passa w × h.

export const ESCALA_MIN = 0.5;
export const ESCALA_MAX = 2;
export const PASSO_ESCALA = 0.1;

export function limitarEscala(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.round(Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, n)) * 10) / 10;
}

export const rotuloEscala = (valor) => `${Math.round(limitarEscala(valor) * 100)}%`;

// Quebra o texto em até maxLinhas linhas que caibam em `largura` (por palavra;
// palavra maior que a linha fica sozinha e o tamanho da letra resolve).
export function quebrarLinhas(ctx, texto, largura, maxLinhas = 3) {
  const palavras = String(texto || "").trim().split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];
  const linhas = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (!atual || ctx.measureText(tentativa).width <= largura) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  if (linhas.length <= maxLinhas) return linhas;
  // sobrou texto: junta o excedente na última linha (a letra encolhe para caber)
  return [...linhas.slice(0, maxLinhas - 1), linhas.slice(maxLinhas - 1).join(" ")];
}

/**
 * Calcula fonte e linhas do "Somente nome" para uma área w × h (em pontos).
 * Começa grande (proporcional à altura × escala) e diminui até tudo caber.
 * `rodape` (ex.: "500 G") sai menor, embaixo, também centralizado.
 */
export function layoutNome(ctx, w, h, { nomes = [], escala = 1, rodape = "", fonteFamilia = "Arial, sans-serif", fonteMin = 14 } = {}) {
  const lista = nomes.map((n) => String(n || "").trim().toUpperCase()).filter(Boolean);
  if (!lista.length) lista.push("PRODUTO");
  const fator = limitarEscala(escala);
  const temRodape = !!String(rodape || "").trim();
  const alturaTexto = h * (temRodape ? 0.8 : 1);
  let fonte = Math.max(fonteMin, Math.round(alturaTexto * (lista.length > 1 ? 0.24 : 0.36) * fator));
  const montar = (f) => {
    ctx.font = `900 ${f}px ${fonteFamilia}`;
    const blocos = lista.map((nome) => quebrarLinhas(ctx, nome, w, lista.length > 1 ? 2 : 3));
    const linhas = blocos.flat();
    const alturaLinha = Math.round(f * 1.12);
    const espacoEntreNomes = lista.length > 1 ? Math.round(f * 0.35) : 0;
    const altura = linhas.length * alturaLinha + espacoEntreNomes * (lista.length - 1);
    const larga = linhas.some((l) => ctx.measureText(l).width > w);
    return { blocos, alturaLinha, espacoEntreNomes, altura, cabe: !larga && altura <= alturaTexto };
  };
  let medida = montar(fonte);
  while (!medida.cabe && fonte > fonteMin) {
    fonte = Math.max(fonteMin, fonte - 2);
    medida = montar(fonte);
  }
  const fonteRodape = temRodape ? Math.max(fonteMin, Math.min(Math.round(fonte * 0.45), Math.round(h * 0.16))) : 0;
  return { ...medida, fonte, fonteRodape, rodape: temRodape ? String(rodape).trim().toUpperCase() : "" };
}

export function desenharNomeCentralizado(ctx, w, h, opcoes = {}) {
  const fonteFamilia = opcoes.fonteFamilia || "Arial, sans-serif";
  const lay = layoutNome(ctx, w, h, opcoes);
  const alturaRodape = lay.rodape ? Math.round(lay.fonteRodape * 1.4) : 0;
  const total = lay.altura + alturaRodape;
  let y = Math.max(0, Math.round((h - total) / 2));
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `900 ${lay.fonte}px ${fonteFamilia}`;
  lay.blocos.forEach((linhas, i) => {
    if (i > 0) y += lay.espacoEntreNomes;
    for (const linha of linhas) {
      ctx.fillText(linha, w / 2, y);
      y += lay.alturaLinha;
    }
  });
  if (lay.rodape) {
    ctx.font = `800 ${lay.fonteRodape}px ${fonteFamilia}`;
    ctx.fillText(lay.rodape, w / 2, y + Math.round(lay.fonteRodape * 0.3));
  }
  return lay;
}

/** Retângulo da imagem centralizada: em 100% ocupa 80% da área; nunca passa da área. */
export function retanguloImagem(larguraImg, alturaImg, w, h, escala = 1) {
  const iw = Number(larguraImg) || 0;
  const ih = Number(alturaImg) || 0;
  if (!(iw > 0 && ih > 0 && w > 0 && h > 0)) return null;
  const caber = Math.min(w / iw, h / ih);
  const fator = Math.min(caber, caber * 0.8 * limitarEscala(escala));
  const dw = Math.round(iw * fator);
  const dh = Math.round(ih * fator);
  return { x: Math.round((w - dw) / 2), y: Math.round((h - dh) / 2), w: dw, h: dh };
}

export function desenharImagemCentralizada(ctx, w, h, imagem, escala = 1) {
  const largura = imagem?.naturalWidth || imagem?.width;
  const altura = imagem?.naturalHeight || imagem?.height;
  const r = retanguloImagem(largura, altura, w, h, escala);
  if (!r) throw new Error("A imagem da etiqueta não carregou. Escolha a imagem de novo.");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(imagem, r.x, r.y, r.w, r.h);
  return r;
}

/** Carrega a imagem (data URL do logo) antes de desenhar — o canvas precisa dela pronta. */
export function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    if (!src) { reject(new Error("Adicione a imagem (logo) antes de imprimir.")); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não consegui ler a imagem da etiqueta. Escolha a imagem de novo."));
    img.src = src;
  });
}
